import spiceypy as spice
import os
import numpy as np
from typing import Tuple, List, Dict, Union

# Kernel paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KERNELS_DIR = os.path.join(BASE_DIR, "kernels")

def load_kernels():
    """Load all SPICE kernels from the kernels directory."""
    # List of kernels to load
    kernels = [
        "naif0012.tls",  # Leapseconds
        "de440.bsp",     # Planetary Ephemeris
        "pck00010.tpc",  # Planetary Constants
    ]
    
    loaded_count = 0
    for kernel in kernels:
        path = os.path.join(KERNELS_DIR, kernel)
        if os.path.exists(path):
            try:
                spice.furnsh(path)
                loaded_count += 1
            except Exception as e:
                print(f"Error loading kernel {kernel}: {e}")
        else:
            print(f"Kernel not found: {path} (Run fetch_kernels.py first)")
            
    # print(f"Loaded {loaded_count}/{len(kernels)} SPICE kernels.")

def utc_to_et(utc_str: str) -> float:
    """Convert UTC string to Ephemeris Time (seconds past J2000)."""
    try:
        return spice.str2et(utc_str)
    except Exception as e:
        raise ValueError(f"Invalid UTC string '{utc_str}': {e}")

def et_to_utc(et: float, format_str: str = "C") -> str:
    """Convert ET to UTC string."""
    return spice.timout(et, "YYYY-MM-DD HR:MN:SC.### ::RND")

def get_body_state(target: str, observer: str, et: float, frame: str = "J2000") -> np.ndarray:
    """Get state vector (position [km], velocity [km/s]) of target relative to observer."""
    try:
        # Using NONE for geometric state (truth)
        state, _ = spice.spkezr(target, et, frame, "NONE", observer)
        return np.array(state)
    except Exception as e:
        print(f"SPICE Error getting state: {e}")
        return np.zeros(6)

def frame_transform(state: np.ndarray, from_frame: str, to_frame: str, et: float) -> np.ndarray:
    """Transform a 6D state vector between frames."""
    mat = spice.sxform(from_frame, to_frame, et)
    return np.dot(mat, state)

def vector_to_radec(position: np.ndarray) -> Tuple[float, float, float]:
    """
    Convert J2000 position vector to Right Ascension and Declination.
    Returns (range, ra, dec) in (km, degrees, degrees).
    """
    # spice.recrad returns range, ra (radians), dec (radians)
    r, ra_rad, dec_rad = spice.recrad(position)
    return r, np.degrees(ra_rad), np.degrees(dec_rad)

def get_apparent_target_radec(target: str, observer_pos_j2k: np.ndarray, et: float) -> Tuple[float, float, float]:
    """
    Get apparent RA/DEC of a target body as seen from an observer at a given J2000 position.
    """
    # 1. Get Target Position relative to Solar System Barycenter (SSB)
    # 2. Observer Position is relative to Sun? Or SSB? 
    # Let's assume observer_pos_j2k is relative to SUN for now if our Sim works that way,
    # or relative to SSB. Standard SPICE usage usually references SSB (0).
    
    # Let's handle observer_pos as relative to SUN (body 10).
    # Target state relative to SUN.
    # Map common names to Barycenter IDs if implied by de440 coverage issues
    # Mars(499) -> 4, Jupiter(599) -> 5, etc.
    # We can trust that spice.spkezr handles string->id conversion, but if 'MARS' maps to 499 
    # and 499 is missing, we must manually map 'MARS' -> '4' or 'MARS BARYCENTER'.
    
    # NAIF ID mapping for DE440 fallback
    FALLBACK_MAP = {
        "MARS": "4",
        "JUPITER": "5",
        "SATURN": "6",
        "URANUS": "7",
        "NEPTUNE": "8",
        "PLUTO": "9"
    }

    target_lookup = FALLBACK_MAP.get(target.upper(), target)

    try:
        # Using NONE for geometric state (truth)
        # Use target_lookup instead of target
        target_state_wrt_sun, _ = spice.spkezr(target_lookup, et, "J2000", "LT+S", "SUN")
        target_pos_wrt_sun = np.array(target_state_wrt_sun[:3])
        
        # Vector from Observer to Target = Target_wrt_Sun - Observer_wrt_Sun
        # (Assuming observer_pos_j2k is defined relative to Sun)
        obs_to_target = target_pos_wrt_sun - observer_pos_j2k
        
        return vector_to_radec(obs_to_target)
    except Exception as e:
        print(f"Error getting apparent RA/DEC for {target} (using {target_lookup}): {e}")
        return 0, 0, 0
