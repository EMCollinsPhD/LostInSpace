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
    make CXX=arm-linux-gnueabihf-g++ CXXFLAGS="-march=armv6 -mfloat-abi=hard -mfpu=vfp"
    ```
    *   *Note*: Ensure you have built the CSPICE library for ARMv6 first, or have a compatible `libcspice.a`. If you cannot compile CSPICE for ARMv6 on your desktop, you may need to compile CSPICE on the Pi itself (slow but reliable) and then copy the static library back to your host, OR just compile the whole project on the Pi (slow).

    **Alternative (Native Build on Pi)**:
    If cross-compilation of CSPICE is too difficult (`toolkit` structure is complex), it might be 10x easier to just compile everything on the Pi since it's C++ (check if 512MB RAM is enough for `g++` on single files).
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
    sudo systemctl start astrogator
    ```
