#!/bin/bash
set -e

# Script to build everything natively on the Raspberry Pi
# Run this from the astrogator/backend directory on the Pi.

echo "=========================================="
echo "      Astrogator Native Build System      "
echo "=========================================="

# 1. Determine Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$BACKEND_DIR")"

CSPICE_SRC="${PROJECT_ROOT}/lib/cspice/src/cspice"
CSPICE_INC="${PROJECT_ROOT}/lib/cspice/include"
CSPICE_LIB_DIR="${PROJECT_ROOT}/lib/cspice/lib"
OUTPUT_LIB="${CSPICE_LIB_DIR}/cspice.a"

# 2. Build CSPICE
echo "[1/2] Building CSPICE library..."
if [ -f "$OUTPUT_LIB" ] && [ "$1" != "--force" ]; then
    echo "CSPICE library found at $OUTPUT_LIB."
    echo "Skipping CSPICE compilation (use --force to rebuild)."
else
    echo "Building CSPICE library..."
    
    # Create a build directory
    BUILD_DIR="${PROJECT_ROOT}/build_cspice_native"
    rm -rf ${BUILD_DIR}
    mkdir -p ${BUILD_DIR}

    cd ${BUILD_DIR}

    # Use native gcc. Let it pick default flags for the machine.
    # -dS is sometimes needed for SPICE, -O2 for perf.
    # We suppress warnings to keep output clean.
    CFLAGS="-O2 -I${CSPICE_INC} -w" 

    echo "Compiling CSPICE sources (may take 2-5 minutes on Pi 1)..."
    # Compile in parallel? Pi 1 is single core. 
    # xargs -P 1 is safe.
    find ${CSPICE_SRC} -name "*.c" -print0 | xargs -0 -P 1 -n 20 gcc ${CFLAGS} -c

    echo "Archiving cspice.a..."
    ar cr cspice.a *.o
    mv cspice.a ${OUTPUT_LIB}

    cd ${PROJECT_ROOT}
    rm -rf ${BUILD_DIR}
    echo "CSPICE built successfully."
fi
# 3. Build Backend
echo "[2/2] Building Astrogator Backend..."
cd ${BACKEND_DIR}

make clean
# Run make with native compiler, no cross-compile flags.
# We enable debug symbols (-g) just in case.
make CXX=g++ CXXFLAGS="-std=c++17 -O2 -Iinclude -Wall -Wextra"

echo "=========================================="
echo "              Build Complete              "
echo "=========================================="
echo "Run with: ./astrogator_backend"
