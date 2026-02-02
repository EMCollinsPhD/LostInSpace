#pragma once
#include <map>
#include <string>
#include <vector>

class Spacecraft {
public:
  std::string id;
  std::vector<double> state; // x,y,z,vx,vy,vz
  double et;
  double fuel;

  Spacecraft();
  Spacecraft(std::string id, std::vector<double> state, double et);

  void propagate(double target_et);
  void apply_burn(const std::vector<double> &dv);
};

class Simulation {
private:
  static Simulation *instance;
  Simulation();

public:
  std::map<std::string, Spacecraft> spacecrafts;
  std::map<std::string, std::string> api_tokens;

  static Simulation *get_instance();
  void init(const std::string &data_dir);
  Spacecraft *get_spacecraft(const std::string &id);
  bool validate_token(const std::string &id, const std::string &token);
};
