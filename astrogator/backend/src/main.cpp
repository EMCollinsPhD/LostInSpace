#include <chrono>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <thread>

#include "engine.hpp"
#include "httplib.h"
#include "json.hpp"
#include "sim.hpp"

using json = nlohmann::json;
using namespace httplib;

// Middleware for CORS
void enable_cors(Response &res) {
  res.set_header("Access-Control-Allow-Origin", "*");
  res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set_header("Access-Control-Allow-Headers", "*");
}

int main(int argc, char **argv) {
  // 1. Initialize Engine
  std::cout << "Initializing SPICE Engine..." << std::endl;
  engine::load_kernels("kernels"); // Assumes run from backend/ root

  // 2. Initialize Sim
  // 2. Initialize Sim
  std::cout << "Initializing Simulation..." << std::endl;
  Simulation *sim = Simulation::get_instance();
  sim->init("data");

  // Load Stars
  json stars_json;
  try {
    std::ifstream f("data/stars.json");
    if (f.is_open()) {
      f >> stars_json;
      std::cout << "Loaded " << stars_json.size() << " stars." << std::endl;
    } else {
      std::cerr << "Warning: Could not open data/stars.json" << std::endl;
      stars_json = json::array();
    }
  } catch (...) {
    std::cerr << "Error parsing stars.json" << std::endl;
    stars_json = json::array();
  }

  // 3. Setup Server
  Server svr;

  // CORS Pre-flight for all
  svr.Options(R"(/.*)",
              [](const Request &req, Response &res) { enable_cors(res); });

  // ROOT (Static File Server)
  // Serve files from ./www directory (where frontend dist/ should be copied)
  auto ret = svr.set_mount_point("/", "www");
  if (!ret) {
    std::cout
        << "Starting without static file server (www directory not found?)"
        << std::endl;
  }

  // API HEALTH CHECK
  svr.Get("/api/health", [](const Request &req, Response &res) {
    enable_cors(res);
    json j;
    j["message"] = "Astrogator C++ Backend Online v0.3.1";
    res.set_content(j.dump(), "application/json");
  });

  // STARS
  svr.Get("/api/nav/stars", [stars_json](const Request &req, Response &res) {
    enable_cors(res);
    res.set_content(stars_json.dump(), "application/json");
  });

  // LIVE ORRERY
  svr.Get("/api/nav/orrery/live", [sim](const Request &req, Response &res) {
    enable_cors(res);

    // Use time from first ship or default
    double et = engine::utc_to_et("2026-01-01T00:00:00");
    if (!sim->spacecrafts.empty()) {
      et = sim->spacecrafts.begin()->second.et;
      // If 0 (init), set to now
      if (et == 0) {
        // Get system time
        auto now = std::chrono::system_clock::now();
        auto tt = std::chrono::system_clock::to_time_t(now);
        // Format to ISO
        std::stringstream ss;
        ss << std::put_time(std::gmtime(&tt), "%Y-%m-%dT%H:%M:%S");
        et = engine::utc_to_et(ss.str());
      }
    }

    std::vector<std::string> bodies = {"MERCURY", "VENUS",   "EARTH",
                                       "MARS",    "JUPITER", "SATURN"};
    json data;

    for (const auto &b : bodies) {
      // Use Barycenters for outer planets if needed by SPICE, but keep keys
      // simple
      std::string target = b;
      if (b == "MARS")
        target = "MARS BARYCENTER";
      if (b == "JUPITER")
        target = "JUPITER BARYCENTER";
      if (b == "SATURN")
        target = "SATURN BARYCENTER";

      data[b] = engine::get_body_position(target, "SUN", et, "ECLIPJ2000");
    }

    json j;
    j["et"] = et;
    j["utc"] = engine::et_to_utc(et);
    j["bodies"] = data;

    res.set_content(j.dump(), "application/json");
  });

  // STATIC ORRERY (Orbits)
  svr.Get("/api/nav/orrery/static", [sim](const Request &req, Response &res) {
    enable_cors(res);

    // Use current time as center
    double et = engine::utc_to_et("2026-01-01T00:00:00");
    if (!sim->spacecrafts.empty()) {
      et = sim->spacecrafts.begin()->second.et;
      if (et == 0)
        et = engine::utc_to_et("2026-01-01T00:00:00");
    }

    std::vector<std::string> bodies = {"MERCURY", "VENUS",   "EARTH",
                                       "MARS",    "JUPITER", "SATURN"};
    json paths;

    for (const auto &b : bodies) {
      std::string target = b;
      if (b == "MARS")
        target = "MARS BARYCENTER";
      if (b == "JUPITER")
        target = "JUPITER BARYCENTER";
      if (b == "SATURN")
        target = "SATURN BARYCENTER";

      paths[b] = engine::get_orbit_path(target, et);
    }

    res.set_content(paths.dump(), "application/json");
  });

  // SENSOR STATE
  svr.Get(R"(/api/nav/state/(\w+))", [sim](const Request &req, Response &res) {
    enable_cors(res);
    std::string id = req.matches[1];

    Spacecraft *sc = sim->get_spacecraft(id);
    if (!sc) {
      res.status = 404;
      return;
    }

    // AUTH CHECK
    std::string auth = req.get_header_value("Authorization");
    std::string token = "";
    if (auth.length() > 7 && auth.substr(0, 7) == "Bearer ") {
      token = auth.substr(7);
    }

    if (!sim->validate_token(id, token)) {
      res.status = 401;
      return;
    }

    // Update Time (Real-time Propagate)
    auto now = std::chrono::system_clock::now();
    auto tt = std::chrono::system_clock::to_time_t(now);
    std::stringstream ss;
    ss << std::put_time(std::gmtime(&tt), "%Y-%m-%dT%H:%M:%S");
    double current_et = engine::utc_to_et(ss.str());

    sc->propagate(current_et);

    // Return state
    json j;
    j["time"]["et"] = sc->et;
    j["time"]["utc"] = engine::et_to_utc(sc->et);
    j["fuel"] = sc->fuel;

    // Observables (Simplification: Just return bodies relative to SC)
    // In real backend we did RA/DEC.
    // For C++ MVP, let's just send back minimal data so frontend doesn't crash?
    // Frontend expects: observables: { bodies: [ {name, ra, dec, mag} ] }

    std::vector<std::string> targets = {
        "SUN",     "MERCURY", "VENUS",  "EARTH",   "MARS",
        "JUPITER", "SATURN",  "URANUS", "NEPTUNE", "PLUTO"};
    json bodies_list = json::array();

    for (const auto &t : targets) {
      std::string target_name = t;

      // Calculate Apparent RA/DEC
      // Observer State: sc->state is J2000 relative to SUN (assuming Sim logic)
      // Actually Sim stores state relative to SUN?
      // sim.cpp init state uses get_body_position(..., "SUN", ...). So yes.
      std::vector<double> obs_pos = {sc->state[0], sc->state[1], sc->state[2]};

      std::vector<double> radec =
          engine::get_apparent_target_radec(t, obs_pos, sc->et);

      bodies_list.push_back({{"name", target_name},
                             {"ra", radec[1]},
                             {"dec", radec[2]},
                             {"mag", -1.0}});
    }
    j["observables"]["bodies"] = bodies_list;

    res.set_content(j.dump(), "application/json");
  });

  // BURN
  svr.Post(R"(/api/cmd/burn/(\w+))", [sim](const Request &req, Response &res) {
    enable_cors(res);
    std::string id = req.matches[1];
    Spacecraft *sc = sim->get_spacecraft(id);
    if (!sc) {
      res.status = 404;
      return;
    }

    // AUTH CHECK
    std::string auth = req.get_header_value("Authorization");
    std::string token = "";
    if (auth.length() > 7 && auth.substr(0, 7) == "Bearer ") {
      token = auth.substr(7);
    }

    if (!sim->validate_token(id, token)) {
      res.status = 401;
      return;
    }

    try {
      auto body = json::parse(req.body);
      // Frontend sends: { delta_v: {x, y, z}, utc_time: ... }
      double dx = body["delta_v"]["x"];
      double dy = body["delta_v"]["y"];
      double dz = body["delta_v"]["z"];

      sc->apply_burn({dx, dy, dz});

      json j;
      j["status"] = "Burn executed";
      j["remaining_fuel"] = sc->fuel;
      res.set_content(j.dump(), "application/json");

    } catch (...) {
      res.status = 400;
    }
  });

  std::cout << "Server listening on 0.0.0.0:8000" << std::endl;
  svr.listen("0.0.0.0", 8000);

  return 0;
}
