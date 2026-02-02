#include <filesystem>
#include <iostream>
#include <mutex>
#include <stdexcept>
#include <string>
#include <vector>

extern "C" {
#include "SpiceUsr.h"
}

namespace fs = std::filesystem;

namespace engine {

// CSPICE is not thread safe.
static std::mutex spice_mutex;

// Load all kernels in the data/kernels directory
void load_kernels(const std::string &kernel_path) {
  std::lock_guard<std::mutex> lock(spice_mutex);
  // Load generic kernels first (tls, pck)
  // Then spk
  // For simplicity, just walk and load everything
  try {
    for (const auto &entry : fs::directory_iterator(kernel_path)) {
      if (entry.path().extension() == ".tls" ||
          entry.path().extension() == ".tpc" ||
          entry.path().extension() == ".bsp" ||
          entry.path().extension() == ".tf") {

        std::string path_str = entry.path().string();
        furnsh_c(path_str.c_str());

        if (failed_c()) {
          char msg[1841];
          getmsg_c("LONG", 1841, msg);
          reset_c();
          std::cerr << "CSPICE Error loading " << path_str << ": " << msg
                    << std::endl;
        } else {
          std::cout << "Loaded kernel: " << path_str << std::endl;
        }
      }
    }
  } catch (const fs::filesystem_error &e) {
    std::cerr << "Filesystem error: " << e.what() << std::endl;
  }
}

// Get position of target relative to observer in frame at et
std::vector<double> get_body_position(const std::string &target,
                                      const std::string &observer, double et,
                                      const std::string &frame) {
  std::lock_guard<std::mutex> lock(spice_mutex);
  double state[6];
  double lt;

  spkgeo_c(atoi(target.c_str()) ? atoi(target.c_str()) : 0, et, frame.c_str(),
           atoi(observer.c_str()) ? atoi(observer.c_str()) : 0, state, &lt);
  // spkgeo_c expects integer IDs if using that interface, or use spkpos_c for
  // names Let's use spkpos_c

  double pos[3];
  spkpos_c(target.c_str(), et, frame.c_str(), "NONE", observer.c_str(), pos,
           &lt);

  if (failed_c()) {
    reset_c();
    return {0, 0, 0};
  }

  return {pos[0], pos[1], pos[2]};
}

// Convert UTC string to Ephemeris Time
double utc_to_et(const std::string &utc_str) {
  std::lock_guard<std::mutex> lock(spice_mutex);
  double et;
  str2et_c(utc_str.c_str(), &et);
  if (failed_c()) {
    reset_c();
    return 0.0;
  }
  return et;
}

// Convert ET to UTC string
std::string et_to_utc(double et) {
  std::lock_guard<std::mutex> lock(spice_mutex);
  char utc_str[24];
  et2utc_c(et, "ISOC", 0, 24, utc_str);
  if (failed_c()) {
    reset_c();
    return "";
  }
  return std::string(utc_str);
}
// Convert J2000 position vector to RA/DEC (degrees)
std::vector<double> vector_to_radec(const std::vector<double> &pos) {
  std::lock_guard<std::mutex> lock(spice_mutex);
  double v[3] = {pos[0], pos[1], pos[2]};
  double range, ra, dec;
  recrad_c(v, &range, &ra, &dec);
  return {range, ra * dpr_c(), dec * dpr_c()};
}

// Get apparent RA/DEC of a target relative to observer
std::vector<double>
get_apparent_target_radec(const std::string &target,
                          const std::vector<double> &obs_pos, double et) {
  std::lock_guard<std::mutex> lock(spice_mutex);
  // 1. Get Target Position relative to SUN int J2000
  double target_pos[3];
  double lt;

  // Handle fallback names if necessary (e.g. MARS -> 4)
  // SPICE usually handles names if ID codes are loaded.
  // We rely on loading standard kernels.
  std::string target_lookup = target;
  if (target == "MARS")
    target_lookup = "4";
  if (target == "JUPITER")
    target_lookup = "5";
  if (target == "SATURN")
    target_lookup = "6";
  if (target == "URANUS")
    target_lookup = "7";
  if (target == "NEPTUNE")
    target_lookup = "8";
  if (target == "PLUTO")
    target_lookup = "9";
  if (target == "MERCURY")
    target_lookup = "1";
  if (target == "VENUS")
    target_lookup = "2";

  spkpos_c(target_lookup.c_str(), et, "J2000", "LT+S", "SUN", target_pos, &lt);

  if (failed_c()) {
    reset_c();
    return {0, 0, 0};
  }

  // 2. Vector from Observer to Target
  // obs_pos is assumed to be J2000 relative to SUN
  double rel_pos[3];
  rel_pos[0] = target_pos[0] - obs_pos[0];
  rel_pos[1] = target_pos[1] - obs_pos[1];
  rel_pos[2] = target_pos[2] - obs_pos[2];

  // 3. Convert to RA/DEC
  double range, ra, dec;
  recrad_c(rel_pos, &range, &ra, &dec);
  return {range, ra * dpr_c(), dec * dpr_c()};
}

// Orbital Periods in days
// Not checking map every time for perf? static map is fine.
static const std::vector<std::pair<std::string, double>> ORBITAL_PERIODS = {
    {"MERCURY", 88.0},   {"VENUS", 224.7},     {"EARTH", 365.2},
    {"MARS", 687.0},     {"JUPITER", 4331.0},  {"SATURN", 10747.0},
    {"URANUS", 30589.0}, {"NEPTUNE", 59800.0}, {"PLUTO", 90560.0}};

std::vector<std::vector<double>>
get_orbit_path(const std::string &target, double center_et, int num_points) {
  // Find period
  double period_days = 365.0;
  std::string lookup_name = target;

  // Strip " BARYCENTER" if present for period lookup
  size_t idx = lookup_name.find(" BARYCENTER");
  if (idx != std::string::npos) {
    lookup_name = lookup_name.substr(0, idx);
  }

  // Simple linear search or map
  for (const auto &p : ORBITAL_PERIODS) {
    if (p.first == lookup_name) {
      period_days = p.second;
      break;
    }
  }

  double period_sec = period_days * 24 * 3600;
  double step = period_sec / num_points;
  double start_et = center_et;

  std::vector<std::vector<double>> points;
  points.reserve(num_points + 1);

  for (int i = 0; i <= num_points; ++i) {
    double t = start_et + (i * step);
    // Use ECLIPJ2000 for Orrery visualization (X = Vernal Equinox, Z = Ecliptic
    // Pole)
    std::vector<double> pos = get_body_position(target, "SUN", t, "ECLIPJ2000");
    points.push_back(pos);
  }
  return points;
}
} // namespace engine
