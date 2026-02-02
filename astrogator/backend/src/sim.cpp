#include "sim.hpp"
#include "engine.hpp"
#include "json.hpp"
#include <fstream>
#include <iostream>

using json = nlohmann::json;

Spacecraft::Spacecraft() : id(""), et(0), fuel(1000.0) {
  state = {0, 0, 0, 0, 0, 0};
}

Spacecraft::Spacecraft(std::string id, std::vector<double> state, double et)
    : id(id), state(state), et(et), fuel(1000.0) {}

void Spacecraft::propagate(double target_et) {
  // Simple drift for now, matching Python logic
  double dt = target_et - this->et;
  if (dt == 0)
    return;

  // Position += Velocity * dt (Linear approximation for inertially fixed frame)
  // Beware: This is very rough for Orbital Mechanics, but matches the "Drift"
  // logic in the previous Python version for MVP. In reality we should use
  // spkpos for Planets, but our ships are just floating? The Python code says
  // "Simple Drift... make Planets move relative to fixed stars". Actually the
  // Python code did NOT update state, just 'et'. Check sim.py L31. "self.et =
  // target_et".

  this->et = target_et;
}

void Spacecraft::apply_burn(const std::vector<double> &dv) {
  if (dv.size() != 3)
    return;
  state[3] += dv[0];
  state[4] += dv[1];
  state[5] += dv[2];

  double mag = std::sqrt(dv[0] * dv[0] + dv[1] * dv[1] + dv[2] * dv[2]);
  fuel -= mag; // Assumes km/s cost if fuel is km/s
}

Simulation *Simulation::instance = nullptr;

Simulation *Simulation::get_instance() {
  if (!instance) {
    instance = new Simulation();
  }
  return instance;
}

Simulation::Simulation() {
  // Init Logic
  // 1. Load Kernels? Already handled in main typically, but let's be safe.

  // 2. Set Start Time
  // Python Used datetime.now() -> utc_to_et
  // We'll trust the engine to have loaded ls kernels.
  // Default to J2000 if fails.
}

void Simulation::init(const std::string &data_dir) {
  // Load Users
  std::string users_path = data_dir + "/users.json";
  std::ifstream f(users_path);
  if (!f.is_open()) {
    std::cerr << "Failed to open " << users_path << std::endl;
    return;
  }

  json users;
  f >> users;

  // Base Position (L1-ish)
  // 1.5 million km sunward of Earth
  std::vector<double> base_pos = {1.48e8, 0, 0};
  std::vector<double> base_vel = {0, 29.78, 0}; // Approx Earth V

  // Try to get real Earth state
  try {
    // Correct Initialization Time: Near "Now" (Feb 2 2026) to avoid 30-day lag
    double et_now = engine::utc_to_et("2026-02-02T12:00:00");

    // Get full state (Pos+Vel) relative to SUN in ECLIPJ2000 (align with
    // Ecliptic)
    std::vector<double> earth_state =
        engine::get_body_state("EARTH", "SUN", et_now, "ECLIPJ2000");

    base_pos = {earth_state[0], earth_state[1], earth_state[2]};
    base_vel = {earth_state[3], earth_state[4], earth_state[5]};

    // L1 Logic: Scale Position AND Velocity to maintain relative formation
    double scale = 0.99;
    base_pos[0] *= scale;
    base_pos[1] *= scale;
    base_pos[2] *= scale;

    base_vel[0] *= scale;
    base_vel[1] *= scale;
    base_vel[2] *= scale;
  } catch (...) {
  }

  for (auto &[key, val] : users.items()) {
    // Store Token
    // In users.json: "username": "token"
    api_tokens[key] = val.get<std::string>();

    // Add random jitter
    std::vector<double> s = base_pos;

    // Pseudo-random jitter (roughly +/- 10000 km)
    // Using string hash of key to be deterministic but different per user
    size_t seed = std::hash<std::string>{}(key);
    double jx = (seed % 20000) - 10000.0;
    double jy = ((seed / 20000) % 20000) - 10000.0;
    double jz = ((seed / 40000) % 20000) - 10000.0;

    s[0] += jx;
    s[1] += jy;
    s[2] += jz;

    s.insert(s.end(), base_vel.begin(), base_vel.end());

    // Initialize ET to correct start time
    double start_et = engine::utc_to_et("2026-02-02T12:00:00");
    spacecrafts[key] = Spacecraft(key, s, start_et);
  }
}

Spacecraft *Simulation::get_spacecraft(const std::string &id) {
  if (spacecrafts.find(id) != spacecrafts.end()) {
    return &spacecrafts[id];
  }
  return nullptr;
}

bool Simulation::validate_token(const std::string &id,
                                const std::string &token) {
  if (api_tokens.find(id) == api_tokens.end())
    return false;
  return api_tokens[id] == token;
}
