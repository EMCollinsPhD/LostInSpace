import os
import urllib.request

KERNELS_DIR = os.path.join(os.path.dirname(__file__), "kernels")
os.makedirs(KERNELS_DIR, exist_ok=True)

KERNELS = [
    # Generic Planetry Ephemeris (DE440) - ~100MB
    {
        "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440.bsp",
        "name": "de440.bsp"
    },
    # Leapseconds (LSK)
    {
        "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls",
        "name": "naif0012.tls"
    },
    # PCK (Planetary Constants Kernel)
    {
        "url": "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00010.tpc",
        "name": "pck00010.tpc"
    }
]

def download_file(url, filepath):
    if os.path.exists(filepath):
        print(f"File {filepath} already exists. Skipping.")
        return
    print(f"Downloading {url} to {filepath}...")
    try:
        urllib.request.urlretrieve(url, filepath)
        print("Done.")
    except Exception as e:
        print(f"Failed to download {url}: {e}")

if __name__ == "__main__":
    print(f"Downloading kernels to {KERNELS_DIR}")
    for k in KERNELS:
        download_file(k["url"], os.path.join(KERNELS_DIR, k["name"]))
