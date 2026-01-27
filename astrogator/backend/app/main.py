from fastapi import FastAPI, HTTPException, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import json
import os
from contextlib import asynccontextmanager

from .engine import (
    load_kernels, utc_to_et, et_to_utc, get_apparent_target_radec, vector_to_radec,
    get_body_position, get_orbit_path, frame_transform
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
    # Use current sim time from any active spacecraft
    sim = get_sim()
    et = None
    
    # Try to find any spacecraft to use as time reference
    if sim.spacecrafts:
        # Just grab the first one
        first_sc = next(iter(sim.spacecrafts.values()))
        et = first_sc.et
        
    if et is None:
        # Fallback if no spacecraft loaded
        et = utc_to_et("2026-01-01T00:00:00")
    
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
    # Use roughly current time to generate the ellipse
    sim = get_sim()
    et = None
    if sim.spacecrafts:
        first_sc = next(iter(sim.spacecrafts.values()))
        et = first_sc.et
    else:
        et = utc_to_et("2026-01-01T00:00:00")
    
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
    if user_id == "admin":
        # Admin View: Use 'arcadia' as the "Observer" platform
        sc = get_sim().get_spacecraft("arcadia")
        # And we will inject other spacecraft as visible bodies below
    else:
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
    bodies = ["SUN", "EARTH", "MARS", "JUPITER", "VENUS", "MERCURY", "SATURN"]
    visible_bodies = []
    
    for body in bodies:
        r, ra, dec = get_apparent_target_radec(body, sc.state[:3], et)
        visible_bodies.append({
            "name": body,
            "ra": ra,
            "dec": dec,
            "mag": -1.0 # Placeholder
        })
        
    if user_id == "admin":
        sim = get_sim()
        for other_id, other_sc in sim.spacecrafts.items():
            if other_id == sc.id: continue # Don't see self (arcadia)
            
            # Calculate RA/DEC of other_sc relative to sc (arcadia)
            # Both are J2000 state. 
            # Vector from sc to other:
            rel_pos = other_sc.state[:3] - sc.state[:3]
            r, ra, dec = vector_to_radec(rel_pos)
            
            visible_bodies.append({
                "name": f"SC: {other_id}",
                "ra": ra,
                "dec": dec,
                "mag": 2.0 # Make them visible
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
async def get_truth_state(sc_id: str, user_id: str = Depends(get_current_user)):
    """Debug endpoint to see actual state."""
    if user_id != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    sc = get_sim().get_spacecraft(sc_id)
    if not sc:
        raise HTTPException(status_code=404, detail="Spacecraft not found")
        
    return {
        "id": sc.id,
        "state": sc.state.tolist(), # [x, y, z, vx, vy, vz]
        "et": sc.et,
        "utc": et_to_utc(sc.et)
    }

@app.get("/api/admin/fleet")
async def get_fleet_state(user_id: str = Depends(get_current_user)):
    """Return all spacecraft states for Orrery (Admin Only)."""
    if user_id != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    sim = get_sim()
    fleet = {}
    for sc_id, sc in sim.spacecrafts.items():
        # Transform J2000 state to ECLIPJ2000 for Orrery visualization
        # Orrery planets are in Ecliptic frame.
        pos_j2000 = sc.state[:3]
        state_eclip = frame_transform(sc.state, "J2000", "ECLIPJ2000", sc.et)
        fleet[sc_id] = list(state_eclip[:3])
        
    return fleet
