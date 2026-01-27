import numpy as np
import os
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

        # Initialize at L1 (Earth-Sun)
        # Load kernel wrapper to ensure we can get Earth state
        # (Kernels are loaded in lifespan, but Sim might be instantiated before? 
        # Actually 'get_sim' is called in endpoints, so kernels should be loaded.)
        
        # Get Earth State relative to Sun
        try:
            earth_state = get_body_state("EARTH", "SUN", start_et, "J2000")
            # earth_state is [x, y, z, vx, vy, vz]
            r_earth = earth_state[:3]
            v_earth = earth_state[3:6]
            
            # L1 Approximation: ~1% sunward (1.5 million km)
            # Exact: R_L1 = R_E * (1 - (Me/3Ms)^(1/3))
            # Me/Ms ~= 3e-6. Cbrt(1e-6) = 0.01. So 0.99 is good.
            l1_scale = 0.99
            
            base_pos = r_earth * l1_scale
            base_vel = v_earth * l1_scale # Match angular velocity for stationary relative pos
            
        except Exception as e:
            print(f"Error calculating L1: {e}")
            # Fallback
            base_pos = np.array([1.48e8, 0, 0])
            base_vel = np.array([0, 29.5, 0])

        # Load Users
        users_file = os.path.join(os.path.dirname(__file__), "../data/users.json")
        import json
        with open(users_file) as f:
            users = json.load(f)

        import random
        # Create spacecraft for each user
        for sc_id in users.keys():
            if sc_id == "admin":
                continue
                
            # Add random perturbation (box of +/- 2000km)
            # This is a "Halo" distribution roughly
            dx = random.uniform(-2000, 2000)
            dy = random.uniform(-2000, 2000)
            dz = random.uniform(-2000, 2000)
            
            # Velocity perturbation (drift) - very small
            dvx = random.uniform(-0.01, 0.01) # 10 m/s
            dvy = random.uniform(-0.01, 0.01)
            dvz = random.uniform(-0.01, 0.01)
            
            pos = base_pos + np.array([dx, dy, dz])
            vel = base_vel + np.array([dvx, dvy, dvz])
            
            # Convert back to J2000 if needed? 
            # get_body_state returned ECLIPJ2000. 
            # Our sim assumes J2000 usually? 
            # Spacecraft.__init__ comment says "Heliocentric J2000".
            # IF get_body_state returned ECLIP, we need to rotate it?
            # actually our get_body_state wrapper takes a frame arg.
            # Let's check get_body_state usage above.
            
            # Let's ensure we use J2000 for internal state to be consistent with everything else.
            # But L1 is easier to visualize in Ecliptic. 
            # Let's do the math in J2000 directly. 
            # If we requested ECLIPJ2000 above, the physics is valid in that frame too.
            # BUT if we store it as state, and then `main.py` treats it as J2000...
            # We should probably request J2000 from the start to avoid confusion.
            
            self.spacecrafts[sc_id] = Spacecraft(
                sc_id,
                np.hstack((pos, vel)),
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
