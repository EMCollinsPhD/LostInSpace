import spiceypy as spice
import os

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(CURRENT_DIR, "astrogator", "backend")
KERNELS_DIR = os.path.join(BACKEND_DIR, "kernels")
SPK_PATH = os.path.join(KERNELS_DIR, "de440.bsp")
LSK_PATH = os.path.join(KERNELS_DIR, "naif0012.tls")

print(f"Inspecting {SPK_PATH}...")

try:
    if os.path.exists(LSK_PATH):
        spice.furnsh(LSK_PATH)
    
    # spkobj usage:
    # ids = spice.stypes.SPICEINT_CELL(1000)
    # spice.spkobj(SPK_PATH, ids) -- This is the standard mechanism
    
    ids = spice.spkobj(SPK_PATH)
    
    print(f"Number of bodies: {spice.card(ids)}")
    
    for i in range(spice.card(ids)):
        body_id = ids[i]
        print(f"Found Body: {body_id}")
        
        coverage = spice.spkcov(SPK_PATH, body_id)
        card = spice.wncard(coverage)
        for j in range(card):
             start, end = spice.wnfetd(coverage, j)
             s_utc = spice.et2utc(start, 'C', 0) if spice.ktotal('TEXT') > 0 else str(start)
             e_utc = spice.et2utc(end, 'C', 0) if spice.ktotal('TEXT') > 0 else str(end)
             print(f"  Type coverage: {start} ({s_utc}) -> {end} ({e_utc})")

except Exception as e:
    print(f"Analysis failed: {e}")
