import spiceypy as spice
import os
import sys
import numpy as np

# Define paths matching engine.py logic
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(CURRENT_DIR, "astrogator", "backend")
KERNELS_DIR = os.path.join(BACKEND_DIR, "kernels")

# print(f"Checking Kernels in: {KERNELS_DIR}")

kernels = [
    "naif0012.tls",
    "de440.bsp",
    "pck00010.tpc",
]

# Load Kernels
try:
    for k in kernels:
        p = os.path.join(KERNELS_DIR, k)
        spice.furnsh(p)
    # print("Kernels loaded.")
except Exception as e:
    print(f"Error loading kernels: {e}")
    sys.exit(1)

et = 0.0 # J2000

print(f"\nTesting State Calculation (J2000, ET={et})...")

targets = [
    ("MARS", "499"),
    ("MARS BARYCENTER", "4"),
    ("JUPITER", "599"),
    ("JUPITER BARYCENTER", "5"),
    ("EARTH", "399"),
]

for name, id_str in targets:
    try:
        # Test using Name
        state, lt = spice.spkezr(name, et, "J2000", "NONE", "SOLAR SYSTEM BARYCENTER")
        print(f"[OK] {name} State wrt SSB: {state[:3]} ...")
    except Exception as e:
        print(f"[FAIL] {name}: {e}")
