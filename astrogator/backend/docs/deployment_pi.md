# Deployment: Raspberry Pi Model B (Rev 2)

**Target Hardware**: Raspberry Pi 1 Model B (2011)
**Architecture**: ARMv6 (ARM1176JZF-S)
**RAM**: 512MB

## 1. Operating System Setup

Because this is an ARMv6 device, modern 64-bit OSs will **not** boot. You must use the "Legacy" 32-bit OS.

1.  Download **Raspberry Pi Imager**.
2.  Choose OS:
    *   Navigate to **Raspberry Pi OS (other)**.
    *   Select **Raspberry Pi OS (Legacy, 32-bit) Lite**.
    *   *Note: "Lite" is crucial. The Desktop version consumes too much RAM.*
3.  In Settings (Gear Icon):
    *   Enable SSH.
    *   Set username (e.g., `pi`) and password.
    *   Configure Wi-Fi if not using Ethernet.
4.  Flash to SD Card (4GB+ recommended).

## 2. Cross-Compilation (Recommended)

Compiling on the Pi itself is too slow. We will cross-compile on your Linux desktop.

### Prerequisites (Host Machine)
Install the ARM cross-compiler:
```bash
sudo apt-get install g++-arm-linux-gnueabihf
```

### Build Instructions

1.  **Makefile Configuration**:
    The provided `Makefile` is set up to detect the cross-compiler if `CROSS_COMPILE` is set, or you can override `CXX`.

2.  **Build**:
    ```bash
    cd backend
    # 1. Compile CSPICE for ARMv6 (Required!)
    ./tools/cross_compile_cspice.sh

    # 2. Build Backend (Static Link for maximum compatibility)
    make clean
    make CXX=arm-linux-gnueabihf-g++ CXXFLAGS="-march=armv6 -mfloat-abi=hard -mfpu=vfp -marm -static" LDFLAGS="-static -pthread"
    ```
    ```
    *   *Note*: The `cross_compile_cspice.sh` script rebuilds the CSPICE static library (`lib/cspice/lib/cspice.a`) for ARM architecture.
    *   *Note*: We use `-static` to avoid issues with mismatched GLIBC versions on older Raspberry Pi OS versions.

    **Option 2: Native Build on Pi (Recommended if you see Segmentation Faults)**
    Since you have `gcc` installed on the Pi, the most robust method is to just build everything there. This avoids all compatibility issues.
    1.  Copy the `backend/` folder (along with `lib/`) to the Pi.
    2.  Run the helper script:
    ```bash
    cd backend
    ./tools/build_native.sh
    ```
    3.  This will compile CSPICE (~5 mins) and the Backend (~1 min) using the Pi's own compiler.
    ```bash
    # On Pi
    sudo apt-get install g++ make
    # Copy source files to Pi...
    cd backend
    make
    ```

3.  Result: `astrogator_backend` binary.

## 3. Deployment

1.  **Transfer Files**:
    ```bash
    scp build_pi/astrogator_backend pi@<PI_IP>:~/
    scp -r data pi@<PI_IP>:~/
    scp -r kernels pi@<PI_IP>:~/
    ```

2.  **Runtime Dependencies** (On the Pi):
    Usually none needed for a static C++ binary, but ensure standard libs are present:
    ```bash
    sudo apt-get update && sudo apt-get install -y libstdc++6
    ```

3.  **Run**:
    ```bash
    ./astrogator_backend
    ```

4.  **Auto-Start (Systemd)**:
    Create `/etc/systemd/system/astrogator.service`:
    ```ini
    [Unit]
    Description=Astrogator Backend
    After=network.target

    [Service]
    ExecStart=/home/pi/astrogator_backend
    WorkingDirectory=/home/pi
    User=pi
    Restart=always

    [Install]
    WantedBy=multi-user.target
    ```
    Enable it:
    ```bash
    sudo systemctl enable astrogator
    sudo systemctl enable astrogator
    sudo systemctl start astrogator
    ```

## 4. Hosting the Frontend

You can host the frontend directly from the C++ backend (saves RAM!).

1.  **Prepare Frontend**:
    Since this is a simple static site, **no build is required**.
    *   (Optional) In `frontend/config.js`, verify `API_BASE = ''`.

2.  **Deploy to Pi**:
    Copy the **entire contents** of the `frontend/` folder (excluding `node_modules` if any) into a folder named `www/` inside your `backend/` directory on the Pi.

    ```bash
    # Example structure on Pi:
    /home/pi/backend/
    ├── astrogator_backend
    ├── data/
    ├── kernels/
    └── www/          <-- Copy of frontend/ (*.html, *.js, *.css)
        ├── index.html
        ├── app.js
        ├── style.css
        └── ...
    ```

3.  **Access**:
    Open `http://<PI_IP>:8000/`.
