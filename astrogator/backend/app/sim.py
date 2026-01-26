import numpy as np
from datetime import datetime, timezone
from typing import Dict
from .engine import get_body_state, load_kernels, utc_to_et

GM_SUN = 1.32712440018e11 

class Spacecraft:
    def __init__(self, sc_id: str, initial_state: np.ndarray, initial_et: float):
        self.id = sc_id
        # State: [x,y,z,vx,vy,vz] (km, km/s) Heliocentric J2000
        self.state = initial_state 
        self.et = initial_et
        self.fuel = 1000.0 # m/s

    def propagate(self, target_et: float):
        """Propagate state to target_et using 2-body approximation (Universal Variables or just Kepler)."""
        dt = target_et - self.et
        if dt == 0:
            return

        # Simple Drift for MVP (Simulate 'Station Keeping' relative to Sun/Earth frame if we wanted, 
        # but here we just drift inertially).
        # Improving this: Linear extrapolation for short steps?
        # self.state[0:3] += self.state[3:6] * dt
        
        # NOTE: For "Lost in Space" assignment 1, simply updating 'et' is enough 
        # to make Planets move relative to the fixed stars. 
        # The ship's motion is small compared to planetary motion if we are just "floating".
        self.et = target_et

    def apply_burn(self, dv: np.ndarray):
        self.state[3:6] += dv
        self.fuel -= np.linalg.norm(dv) # km/s cost
        # Convert to m/s for display logic elsewhere if needed, 
        # but here we keep fuel budget in km/s or similar units? 
        # UI says "m/s", so let's adjust cost.
        # If input dv is km/s, and fuel is m/s.
        # self.fuel -= np.linalg.norm(dv) * 1000

class Simulation:
    def __init__(self):
        self.spacecrafts: Dict[str, Spacecraft] = {}
        
        # Initialize at Current Real Time
        # Using datetime.now(timezone.utc)
        try:
            now = datetime.now(timezone.utc)
            # Format explicitly for SPICE: YYYY-MM-DDTHH:MM:SS
            now_str = now.strftime("%Y-%m-%dT%H:%M:%S")
            start_et = utc_to_et(now_str)
        except Exception as e:
            print(f"Time Init Error: {e}")
            start_et = 0.0

        # Mock initial state (Heliocentric) near Earth
        # Earth is ~1AU x.
        self.spacecrafts["student1"] = Spacecraft(
            "student1", 
            np.array([1.496e8, 1000.0, 0.0, 0.0, 29.78, 0.0]), 
            start_et
        )
        self.spacecrafts["emc2"] = Spacecraft(
            "emc2", 
            np.array([1.496e8 + 5000, 1000.0 + 5000, 0.0, 0.0, 29.78, 0.0]), 
            start_et
        )

    def get_spacecraft(self, sc_id: str) -> Spacecraft:
        # Auto-update to current time on access?
        # Yes, for "Real Time" sim.
        sc = self.spacecrafts.get(sc_id)
        if sc:
            try:
                now = datetime.now(timezone.utc)
                now_str = now.strftime("%Y-%m-%dT%H:%M:%S")
                current_et = utc_to_et(now_str)
                # "Propagate" simply updates time for now
                sc.propagate(current_et)
            except:
                pass
        return sc

_sim_instance = None

def get_sim() -> Simulation:
    global _sim_instance
    if _sim_instance is None:
        _sim_instance = Simulation()
    return _sim_instance
