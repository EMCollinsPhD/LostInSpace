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
    double et_now = engine::utc_to_et("2026-01-01T00:00:00"); // Start epoch
    std::vector<double> earth =
        engine::get_body_position("EARTH", "SUN", et_now, "J2000");
    // Simplified Logic: Just place them near Earth for now to ensure visibility
    base_pos = earth;
    // Scale slightly sunward (0.99)
    base_pos[0] *= 0.99;
    base_pos[1] *= 0.99;
    base_pos[2] *= 0.99;
  } catch (...) {
  }

  for (auto &[key, val] : users.items()) {
    if (key == "admin")
      continue;

    // Add random jitter
    std::vector<double> s = base_pos;
    s.insert(s.end(), base_vel.begin(), base_vel.end());

    // Simple jitter (pseudo-random)
    // In C++ we'd use <random>, keeping it simple here

    spacecrafts[key] =
        Spacecraft(key, s, 0.0); // 0.0 ET will be updated on first tick
  }
}

Spacecraft *Simulation::get_spacecraft(const std::string &id) {
  if (spacecrafts.find(id) != spacecrafts.end()) {
    return &spacecrafts[id];
  }
  return nullptr;
}
