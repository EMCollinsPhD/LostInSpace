#include <filesystem>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

extern "C" {
#include "SpiceUsr.h"
}

namespace fs = std::filesystem;

namespace engine {

// Load all kernels in the data/kernels directory
void load_kernels(const std::string &kernel_path) {
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
  char utc_str[24];
  et2utc_c(et, "ISOC", 0, 24, utc_str);
  if (failed_c()) {
    reset_c();
    return "";
  }
  return std::string(utc_str);
}
} // namespace engine
