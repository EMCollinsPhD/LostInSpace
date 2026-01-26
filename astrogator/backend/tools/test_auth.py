import requests
import sys

BASE_URL = "http://localhost:8000"

def test_auth():
    print(f"Testing Auth at {BASE_URL}...")
    
    # 1. Test Without Header (Should Fail)
    try:
        res = requests.get(f"{BASE_URL}/api/nav/state/student1")
        if res.status_code == 403: # Or 401 depending on how we implement
            print("[OK] No Header -> 403/401")
        else:
            print(f"[FAIL] No Header -> {res.status_code}")
    except Exception as e:
        print(f"[FAIL] Conn Error: {e}")

    # 2. Test With Valid Header (Should Pass)
    try:
        headers = {"Authorization": "Bearer alpha-bravo-charlie"} # student1 token from users.json
        res = requests.get(f"{BASE_URL}/api/nav/state/student1", headers=headers)
        if res.status_code == 200:
            print("[OK] Valid Header -> 200")
        else:
            print(f"[FAIL] Valid Header -> {res.status_code}")
    except Exception as e:
        print(f"[FAIL] Conn Error: {e}")

    # 3. Test With Invalid Token (Should Fail)
    try:
        headers = {"Authorization": "Bearer wrong-token"}
        res = requests.get(f"{BASE_URL}/api/nav/state/student1", headers=headers)
        if res.status_code == 401:
            print("[OK] Invalid Token -> 401")
        else:
            print(f"[FAIL] Invalid Token -> {res.status_code}")
    except Exception as e:
        print(f"[FAIL] Conn Error: {e}")

    # 4. Test Authorization (Valid Token, Wrong ID) (Should Fail)
    try:
        headers = {"Authorization": "Bearer alpha-bravo-charlie"} # student1
        res = requests.get(f"{BASE_URL}/api/nav/state/student2", headers=headers) # accessing student2
        if res.status_code == 403:
            print("[OK] Wrong User -> 403")
        else:
            print(f"[FAIL] Wrong User -> {res.status_code}")
    except Exception as e:
          print(f"[FAIL] Conn Error: {e}")

if __name__ == "__main__":
    test_auth()
