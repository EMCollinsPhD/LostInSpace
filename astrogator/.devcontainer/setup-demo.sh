#!/bin/bash
set -e

echo "Starting Astrogator Demo Setup..."

# 1. Fetch Kernels
echo "Fetching SPICE kernels..."
python3 backend/fetch_kernels.py

# 2. Install Frontend Dependencies (for local dev option)
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

# 3. Build Docker Containers
echo "Building Docker containers..."
docker compose build

echo "Setup Complete! Run 'docker compose up' to start the demo."
