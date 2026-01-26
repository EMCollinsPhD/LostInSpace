from fastapi import FastAPI, HTTPException, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import json
import os
from contextlib import asynccontextmanager

from .engine import (
    load_kernels, utc_to_et, et_to_utc, get_apparent_target_radec, vector_to_radec,
    get_body_position, get_orbit_path
)
from .sim import get_sim, Spacecraft
from .models import StateVector, Vector3, BurnCommand, StarData
from .auth import get_current_user

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load SPICE kernels on startup
    load_kernels()
    yield
    # Clean up if needed

app = FastAPI(title="Astrogator API", version="0.2.3", lifespan=lifespan)

# CORS Configuration
origins = [
    "http://localhost:5173",    # Vite default
    "http://127.0.0.1:5173",    # For local dev testing
    "http://173.235.214.113:5173" # Static IP when deployed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Stars
STARS_FILE = os.path.join(os.path.dirname(__file__), "data", "stars.json")
try:
    with open(STARS_FILE, "r") as f:
        STARS_DB = json.load(f)
except Exception as e:
    print(f"Warning: Could not load stars.json: {e}")
    STARS_DB = []

@app.get("/")
async def root():
    return {"message": "Astrogator GNC Online"}

@app.get("/api/nav/stars")
async def get_stars():
    """Return the static star catalog."""
    return STARS_DB

@app.get("/api/nav/orrery/live")
async def get_orrery_live():
    """Return current positions of solar system bodies."""
    # Use current sim time (or real time if sim not persistent)
    # Ideally should use sim time.
    sim = get_sim()
    # We can use the first spacecraft's time as the "Sim Time"
    # or just use real time for the Overview if it's meant to be "Now".
    # Let's use 'emc2' or 'student1' time if available, else real time.
    
    # For now, just grab student1 time
    sc = sim.get_spacecraft("student1")
    et = sc.et if sc else utc_to_et("2026-01-01T00:00:00")
    
    bodies = ["MERCURY", "VENUS", "EARTH", "MARS", "JUPITER", "SATURN"]
    data = {}
    for b in bodies:
        data[b] = get_body_position(b, et)
        
    return {
        "et": et,
        "utc": et_to_utc(et),
        "bodies": data
    }

@app.get("/api/nav/orrery/static")
async def get_orrery_static():
    """Return orbital paths for solar system bodies (Initial Load)."""
    # Use roughly current time to generate the ellipse
    sim = get_sim()
    sc = sim.get_spacecraft("student1")
    et = sc.et if sc else utc_to_et("2026-01-01T00:00:00")
    
    bodies = ["MERCURY", "VENUS", "EARTH", "MARS", "JUPITER", "SATURN"]
    paths = {}
    for b in bodies:
        # Generate 120 points for smoothness
        paths[b] = get_orbit_path(b, et, num_points=120)
        
    return paths

@app.get("/api/nav/state/{sc_id}")
async def get_nav_state(sc_id: str, user_id: str = Depends(get_current_user)):
    """
    Get the spacecraft's current "Sensor" state: Time and Starfield.
    In a real blind scenario, we wouldn't return position/velocity here,
    but for the UI instrument panel, we might want to return them 'hidden' or 
    just return the observables.
    """
    if user_id != sc_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this spacecraft")

    sc = get_sim().get_spacecraft(sc_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Spacecraft not found")
    
    # Construct observable data
    et = sc.et
    utc = et_to_utc(et)
    
    # Calculate visible bodies (Planets + Sun)
    # We treat the spacecraft position as relative to SUN for these calcs
    bodies = ["SUN", "EARTH", "MARS", "JUPITER", "VENUS"]
    visible_bodies = []
    
    for body in bodies:
        r, ra, dec = get_apparent_target_radec(body, sc.state[:3], et)
        visible_bodies.append({
            "name": body,
            "ra": ra,
            "dec": dec,
            "mag": -1.0 # Placeholder
        })
        
    # Calculate stars (treated as infinite distance, so RA/DEC is constant J2000 catalog value?)
    # Proper motion is negligible for this. Parallax negligible.
    # So we just return the catalog stars. Their apparent RA/DEC is their catalog RA/DEC.
    # We assume 'J2000' frame for the instrument panel.
    
    return {
        "time": {
            "et": et,
            "utc": utc
        },
        "observables": {
            "bodies": visible_bodies,
            # "stars": STARS_DB # Moved to /api/nav/stars
        },
        "fuel": sc.fuel
    }

@app.post("/api/cmd/burn/{sc_id}")
async def execute_burn(sc_id: str, command: BurnCommand, user_id: str = Depends(get_current_user)):
    if user_id != sc_id:
        raise HTTPException(status_code=403, detail="Not authorized to control this spacecraft")
        
    sc = get_sim().get_spacecraft(sc_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Spacecraft not found")
    
    # In a real sim, we'd propagate to command.utc_time first.
    # For now, apply immediately or propagate sim to that time?
    # Let's assume immediate applied at current sim time for MVP simplification
    # unless command.utc_time is in future.
    
    dv = np.array([command.delta_v.x, command.delta_v.y, command.delta_v.z])
    sc.apply_burn(dv)
    
    return {"status": "Burn executed", "remaining_fuel": sc.fuel}

@app.get("/api/admin/truth/{sc_id}")
async def get_truth_state(sc_id: str):
    """Debug endpoint to see actual state."""
    sc = get_sim().get_spacecraft(sc_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Spacecraft not found")
        
    return {
        "id": sc.id,
        "state": sc.state.tolist(), # [x, y, z, vx, vy, vz]
        "et": sc.et,
        "utc": et_to_utc(sc.et)
    }
