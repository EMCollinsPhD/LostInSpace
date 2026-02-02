#!/bin/bash
set -e

# Robustly find project root relative to this script
# Script is in backend/tools/cross_compile_cspice.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$BACKEND_DIR")"

# Define Paths
CSPICE_SRC="${PROJECT_ROOT}/lib/cspice/src/cspice"
CSPICE_INC="${PROJECT_ROOT}/lib/cspice/include"
OUTPUT_LIB="${PROJECT_ROOT}/lib/cspice/lib/cspice.a"

# Compiler Settings
CC="arm-linux-gnueabihf-gcc"
CFLAGS="-march=armv6 -mfloat-abi=hard -mfpu=vfp -marm -O2 -I${CSPICE_INC} -DSOC_LINUX"

echo "=========================================="
echo "Cross-Compiling CSPICE for Raspberry Pi 1"
echo "=========================================="
echo "Project Root: ${PROJECT_ROOT}"
echo "Source: ${CSPICE_SRC}"
echo "Output: ${OUTPUT_LIB}"
echo "Compiler: ${CC}"
echo "=========================================="

if [ ! -d "${CSPICE_SRC}" ]; then
    echo "Error: CSPICE source not found at ${CSPICE_SRC}"
    exit 1
fi

# Create temp build dir
BUILD_DIR="${PROJECT_ROOT}/build_cspice_arm"
rm -rf ${BUILD_DIR}
mkdir -p ${BUILD_DIR}

echo "Compiling ~1500 files... (Parallel Jobs: $(nproc))"

cd ${BUILD_DIR}

# Compile
find ${CSPICE_SRC} -name "*.c" -print0 | xargs -0 -P $(nproc) -n 20 ${CC} ${CFLAGS} -c

echo "Archiving objects into static library..."
ar cr cspice.a *.o

echo "Installing to ${OUTPUT_LIB}..."
mv cspice.a ${OUTPUT_LIB}

# Cleanup
cd ${PROJECT_ROOT}
rm -rf ${BUILD_DIR}

echo "Success! ARMv6 CSPICE library created."
