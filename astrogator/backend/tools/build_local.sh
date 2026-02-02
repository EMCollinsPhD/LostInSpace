#!/bin/bash
set -e

# Script to build everything for the LOCAL HOST (x86_64)
# Use this to restore the environment after cross-compilation.

echo "=========================================="
echo "      Astrogator LOCAL Build System       "
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
echo "[1/2] Rebuilding CSPICE library for HOST..."
# Always rebuild if we suspect it might be ARM
# Or just force it.
# Let's just do it.

# Create a build directory
BUILD_DIR="${PROJECT_ROOT}/build_cspice_host"
rm -rf ${BUILD_DIR}
mkdir -p ${BUILD_DIR}

cd ${BUILD_DIR}

# Host GCC
CC=gcc
CFLAGS="-c -O2 -fPIC -w -I${CSPICE_INC}"

echo "Compiling CSPICE sources..."
find ${CSPICE_SRC} -name "*.c" -print0 | xargs -0 -P $(nproc) -n 20 ${CC} ${CFLAGS}

echo "Archiving cspice.a..."
ar cr cspice.a *.o
mv cspice.a ${OUTPUT_LIB}

cd ${PROJECT_ROOT}
rm -rf ${BUILD_DIR}
echo "CSPICE built successfully (x86_64)."

# 3. Build Backend
echo "[2/2] Building Astrogator Backend (Local)..."
cd ${BACKEND_DIR}

make clean
# Standard build
make

echo "=========================================="
echo "           Local Build Complete           "
echo "=========================================="
