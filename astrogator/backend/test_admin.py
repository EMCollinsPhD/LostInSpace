
import sys
import os
import json
from fastapi.testclient import TestClient
sys.path.append("/home/emc/courses/LostInSpace/astrogator/backend")
from app.main import app
from app.engine import load_kernels

def test_admin():
    load_kernels()
    with TestClient(app) as client:
        # Load users to get tokens
        with open("/home/emc/courses/LostInSpace/astrogator/backend/data/users.json") as f:
            users = json.load(f)
            
        admin_token = users['admin']
        noctis_token = users['noctis']
        
        print(f"Admin Token: {admin_token[:5]}...")
        print(f"Noctis Token: {noctis_token[:5]}...")
        
        # 1. Test Admin accessing Fleet
        print("\n[TEST] Admin accessing /api/admin/fleet")
        res = client.get("/api/admin/fleet", headers={"Authorization": f"Bearer {admin_token}"})
        if res.status_code == 200:
            fleet = res.json()
            print(f"PASS: Got fleet with {len(fleet)} ships.")
            if "arcadia" in fleet and "noctis" in fleet:
                 print("PASS: arcadia and noctis found in fleet.")
        else:
            print(f"FAIL: {res.status_code} {res.text}")

        # 2. Test Admin accessing Truth
        print("\n[TEST] Admin accessing /api/admin/truth/noctis")
        res = client.get("/api/admin/truth/noctis", headers={"Authorization": f"Bearer {admin_token}"})
        if res.status_code == 200:
            print("PASS: Got truth state.")
        else:
            print(f"FAIL: {res.status_code} {res.text}")

        # 3. Test Student accessing Fleet (Should Fail)
        print("\n[TEST] Noctis accessing /api/admin/fleet")
        res = client.get("/api/admin/fleet", headers={"Authorization": f"Bearer {noctis_token}"})
        if res.status_code == 403:
            print("PASS: Access Denied (403).")
        else:
            print(f"FAIL: Expected 403, got {res.status_code}")

        # 4. Test Admin Star Tracker View (Should see other ships)
        print("\n[TEST] Admin accessing /api/nav/state/admin")
        res = client.get("/api/nav/state/admin", headers={"Authorization": f"Bearer {admin_token}"})
        if res.status_code == 200:
            data = res.json()
            bodies = data['observables']['bodies']
            sc_targets = [b['name'] for b in bodies if b['name'].startswith("SC:")]
            print(f"PASS: Admin sees {len(sc_targets)} spacecraft targets.")
            if len(sc_targets) > 0:
                print(f"Sample: {sc_targets[0]}")
        else:
            print(f"FAIL: {res.status_code} {res.text}")

if __name__ == "__main__":
    test_admin()
