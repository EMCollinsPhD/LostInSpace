
import sys
import os
import json
sys.path.append("/home/emc/courses/LostInSpace/astrogator/backend")

from app.engine import load_kernels, get_apparent_target_radec, get_body_position

def verify():
    load_kernels()
    
    # Test Mercury and Saturn
    observer = [1.5e8, 0, 0] # Mock observer at 1 AU
    et = 0.0 # J2000
    
    print("Testing Mercury RA/DEC:")
    r, ra, dec = get_apparent_target_radec("MERCURY", observer, et)
    print(f"MERCURY: RA={ra:.2f}, DEC={dec:.2f}")
    
    print("\nTesting Saturn RA/DEC:")
    r, ra, dec = get_apparent_target_radec("SATURN", observer, et)
    print(f"SATURN: RA={ra:.2f}, DEC={dec:.2f}")
    
    # Check if stars.json loads
    stars_path = "/home/emc/courses/LostInSpace/astrogator/backend/app/data/stars.json"
    if os.path.exists(stars_path):
        print(f"\nFOUND stars.json at {stars_path}")
        with open(stars_path) as f:
            data = json.load(f)
            print(f"Loaded {len(data)} stars")
            print(f"First star: {data[0]}")
            if "name" in data[0]:
                print("Star has 'name' field: OK")
            else:
                print("Star MISSING 'name' field: FAIL")
    else:
        print(f"\nMISSING stars.json at {stars_path}")

if __name__ == "__main__":
    verify()
