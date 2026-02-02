import sys
import os

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from astrogator.backend.app.engine import load_kernels
from astrogator.backend.app.sim import get_sim

print("Testing delayed initialization...")
# 1. Load Kernels first (mimicking lifespan)
load_kernels()

# 2. Access Sim (triggering init)
try:
    sim = get_sim()
    sc = sim.get_spacecraft("student1")
    print(f"Success! Sim Object Initialized. ET: {sc.et:.2f}")
except Exception as e:
    print(f"FAILED: {e}")
