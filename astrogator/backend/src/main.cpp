#include <chrono>
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
  std::cout << "Initializing Simulation..." << std::endl;
  Simulation *sim = Simulation::get_instance();
  sim->init("data");

  // 3. Setup Server
  Server svr;

  // CORS Pre-flight for all
  svr.Options(R"(/.*)",
              [](const Request &req, Response &res) { enable_cors(res); });

  // ROOT
  svr.Get("/", [](const Request &req, Response &res) {
    enable_cors(res);
    json j;
    j["message"] = "Astrogator C++ Backend Online";
    res.set_content(j.dump(), "application/json");
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

    std::vector<std::string> bodies = {"MERCURY",
                                       "VENUS",
                                       "EARTH",
                                       "MARS BARYCENTER",
                                       "JUPITER BARYCENTER",
                                       "SATURN BARYCENTER"};
    json data;

    for (const auto &b : bodies) {
      std::cout << "Querying " << b << std::endl;
      data[b] = engine::get_body_position(b, "SUN", et, "ECLIPJ2000");
    }

    json j;
    j["et"] = et;
    j["utc"] = engine::et_to_utc(et);
    j["bodies"] = data;

    res.set_content(j.dump(), "application/json");
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

    std::vector<std::string> targets = {"SUN", "EARTH", "MARS BARYCENTER",
                                        "JUPITER BARYCENTER"};
    json bodies_list = json::array();

    for (const auto &t : targets) {
      // Vector SC -> Target
      std::vector<double> t_pos =
          engine::get_body_position(t, "SUN", sc->et, "J2000");
      // SC pos is relative to Sun in J2000
      double dx = t_pos[0] - sc->state[0];
      double dy = t_pos[1] - sc->state[1];
      double dz = t_pos[2] - sc->state[2];

      // Convert string buffer
      bodies_list.push_back({{"name", t},
                             {"ra", 0.0},  // Placeholder
                             {"dec", 0.0}, // Placeholder
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
