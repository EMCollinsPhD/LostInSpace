
import sys
import os
import numpy as np
sys.path.append("/home/emc/courses/LostInSpace/astrogator/backend")

from app.sim import get_sim
from app.engine import get_body_state, load_kernels

def verify_l1():
    load_kernels()
    sim = get_sim()
    print(f"Initialized {len(sim.spacecrafts)} spacecraft.")
    
    # Get Earth position for reference
    # sim.spacecrafts['emc2'].et should be start time
    et = sim.spacecrafts['emc2'].et
    earth_state = get_body_state("EARTH", "SUN", et, "J2000")
    r_earth_vec = earth_state[:3]
    r_earth_mag = np.linalg.norm(r_earth_vec)
    
    print(f"Earth Distance from Sun: {r_earth_mag:.2f} km")
    
    # Check spacecraft
    for sc_id, sc in sim.spacecrafts.items():
        pos = sc.state[:3]
        dist_sun = np.linalg.norm(pos)
        dist_earth = np.linalg.norm(pos - r_earth_vec)
        
        # Check alignment
        # Dot product of Earth vector and SC vector should be essentially 1.0 (collinear)
        alignment = np.dot(pos, r_earth_vec) / (dist_sun * r_earth_mag)
        
        print(f"SC {sc_id:10s}: Sun Dist={dist_sun:.2f} km, Earth Dist={dist_earth:.2f} km, Align={alignment:.6f}")
        
        # Verify L1 approx (Earth Dist approx 1.5 million km, Sun Dist < Earth Dist)
        if dist_earth < 1.4e6 or dist_earth > 1.6e6:
            print(f"  [WARN] {sc_id} is not near expected L1 distance (1.5M km)")
        if dist_sun > r_earth_mag:
            print(f"  [WARN] {sc_id} is further than Earth (L2?)")
            
if __name__ == "__main__":
    verify_l1()
