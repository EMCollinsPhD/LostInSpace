# Deployment Implementation Plan

This plan details the steps to prepare the Astrogator backend for self-hosting with Docker and Caddy, while keeping the frontend on GitHub Pages.

## User Requirements
- **Hybrid Hosting**: Backend on home server (Static IP), Frontend on GitHub Pages.
- **CORS**: Seamless switch between Dev (localhost) and Prod (GitHub Pages) without code edits.
- **Security**: HTTPS for backend (via Caddy).
- **Containerization**: Docker refresher needed.

## 1. Environment-Aware CORS (`backend/app/main.py`)
To satisfy "work with both", we will modify `main.py` to:
1.  **Always** trust localhost/127.0.0.1 (for dev and local testing).
2.  **Conditionally** trust a production domain defined in an Environment Variable (`ALLOWED_ORIGIN`).
    - This means you can just set `ALLOWED_ORIGIN=https://your-username.github.io` in your Docker config, and it works without changing python code.

## 2. Containerization (`backend/Dockerfile`)
We need a `Dockerfile` that:
1.  Uses a lightweight Python base (e.g., `python:3.11-slim`).
2.  Installs system dependencies (if any needed for numpy/spiceypy).
3.  Installs python requirements.
4.  **Problem**: SPICE Kernels.
    - **Development Strategy**: Only copy the code. Mount the `kernels/` directory as a **Volume**.
    - This keeps the image small and allows you to update kernels on the host without rebuilding the image.

## 3. Reverse Proxy (`Caddyfile`)
Why Caddy?
- **Nginx**: Requires manual SSL setup (`certbot`). Configuration is complex (`server { listen 443; ... }`).
- **Caddy**: **Automatic HTTPS**. You just write your domain, and it talks to Let's Encrypt for you.
- We will provide a `Caddyfile` template:
  ```caddy
  {your-static-ip-domain-name} {
      reverse_proxy backend_container:8000
  }
  ```

## 4. Documentation (`DEPLOY.md`)
A complete guide covering:
1.  **Prerequisites**: Install Docker & Docker Compose.
2.  **Setup**: Clone repo, map volume for kernels.
3.  **Run**: `docker compose up -d`.
4.  **Frontend**: How to set `API_BASE` in `config.js` for the build (or use Env var there too).

## Verification Plan
- **Build Test**: Verify `docker build` succeeds.
- **Run Test**: Verify backend starts inside Docker.
- **Endpoint Check**: `curl localhost:8000/api/nav/bodies` from host.
