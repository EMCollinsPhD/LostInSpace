from pydantic import BaseModel
from typing import List, Optional

class Vector3(BaseModel):
    x: float
    y: float
    z: float

class StateVector(BaseModel):
    position: Vector3
    velocity: Vector3
    et: float  # Ephemeris Time

class BurnCommand(BaseModel):
    delta_v: Vector3
    utc_time: str  # Time to execute burn

class SpacecraftState(BaseModel):
    id: str
    last_updated_et: float
    state: StateVector
    fuel_remaining: float

class StarData(BaseModel):
    name: str
    ra: float
    dec: float
    mag: float
