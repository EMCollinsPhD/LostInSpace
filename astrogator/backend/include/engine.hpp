#pragma once
#include <string>
#include <vector>

namespace engine {
void load_kernels(const std::string &kernel_path);
std::vector<double> get_body_position(const std::string &target,
                                      const std::string &observer, double et,
                                      const std::string &frame = "J2000");
double utc_to_et(const std::string &utc_str);
std::string et_to_utc(double et);
} // namespace engine
