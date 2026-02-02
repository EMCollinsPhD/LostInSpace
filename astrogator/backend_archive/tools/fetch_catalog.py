import gzip
import json
import os
import urllib.request
import math

# URL for Yale Bright Star Catalog (gzipped)
BSC5_URL = "http://tdc-www.harvard.edu/catalogs/ybsc5.gz"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "../app/data/stars.json")

def download_catalog():
    print(f"Downloading {BSC5_URL}...")
    try:
        with urllib.request.urlopen(BSC5_URL) as response:
            return gzip.decompress(response.read()).decode('latin-1')
    except Exception as e:
        print(f"Failed to download: {e}")
        return None

def parse_coordinate(h_d, m, s):
    try:
        val = float(h_d)
        if val < 0:
            return val - float(m)/60 - float(s)/3600
        else:
            return val + float(m)/60 + float(s)/3600
    except ValueError:
        return 0.0

def parse_catalog(data):
    stars = []
    lines = data.split('\n')
    
    print(f"Parsing {len(lines)} entries...")
    
    for line in lines:
        if len(line) < 100: continue
        
        try:
            # Fixed width parsing based on BSC5 format
            # HR Number: 0-4
            hr_num = line[0:4].strip()
            
            # Name: 4-14 (Flamsteed/Bayer)
            name = line[4:14].strip()
            if not name:
                name = f"HR {hr_num}"
            
            # J2000 Position (preferred) is usually later in the file, 
            # but BSC5 standard entries often have B1900.
            # Let's check the byte offsets carefully.
            # Based on typical BSC5 description:
            # RA (J2000): 75-77 (h), 77-79 (m), 79-83 (s)
            # Dec (J2000): 83 (sign), 84-86 (d), 86-88 (m), 88-90 (s)
            
            ra_h = line[75:77]
            ra_m = line[77:79]
            ra_s = line[79:83]
            
            dec_sgn = line[83:84]
            dec_d = line[84:86]
            dec_m = line[86:88]
            dec_s = line[88:90]
            
            # V Magnitude: 102-107
            v_mag_str = line[102:107].strip()
            
            # B-V Color: 109-114
            bv_str = line[109:114].strip()
            
            # Spectral Type: 127-147
            spect = line[127:147].strip()
            
            # Parse Values
            if not ra_h.strip() or not dec_d.strip() or not v_mag_str:
                continue
                
            ra_deg = (float(ra_h) + float(ra_m)/60 + float(ra_s)/3600) * 15.0
            
            dec_deg = float(dec_d) + float(dec_m)/60 + float(dec_s)/3600
            if dec_sgn == '-':
                dec_deg = -dec_deg
                
            v_mag = float(v_mag_str)
            bv = float(bv_str) if bv_str else 0.0
            
            # Filter limit (Naked eye limit approx 6.5)
            if v_mag > 6.5:
                continue

            stars.append({
                "name": name,
                "ra": round(ra_deg, 4),
                "dec": round(dec_deg, 4),
                "mag": v_mag,
                "bv": bv,
                "spect": spect
            })
            
        except ValueError:
            continue
            
    return stars

def main():
    raw_data = download_catalog()
    if not raw_data:
        print("Aborting.")
        return
        
    stars = parse_catalog(raw_data)
    print(f"Successfully parsed {len(stars)} stars.")
    
    # Sort by brightness
    stars.sort(key=lambda x: x['mag'])
    
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(stars, f, indent=None) # Compact JSON
        
    print(f"Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
