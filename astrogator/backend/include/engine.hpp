#pragma once
#include <string>
#include <vector>

namespace engine {
// Convert J2000 position vector to RA/DEC (degrees)
// Returns {radius, ra, dec}
std::vector<double> vector_to_radec(const std::vector<double> &pos);

// Get apparent RA/DEC of a target relative to observer
// Returns {radius, ra, dec}
std::vector<double>
get_apparent_target_radec(const std::string &target,
                          const std::vector<double> &obs_pos, double et);

// Get orbital path (list of position vectors)
// Returns vector of {x,y,z} vectors
std::vector<std::vector<double>> get_orbit_path(const std::string &target,
                                                double center_et,
                                                int num_points = 120);

// Load all kernels in the data/kernels directory
void load_kernels(const std::string &kernel_path);
std::vector<double> get_body_position(const std::string &target,
                                      const std::string &observer, double et,
                                      const std::string &frame);
double utc_to_et(const std::string &utc_str);
std::string et_to_utc(double et);
} // namespace engine
