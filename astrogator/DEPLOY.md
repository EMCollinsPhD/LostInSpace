# Deployment Guide for Astrogator

This guide covers how to deploy the **Astrogator** application in a hybrid environment:
- **Backend**: Self-hosted on a Raspberry Pi or Home Server (Static IP) using Docker & Caddy.
- **Frontend**: Hosted on GitHub Pages (static site hosting).

## Prerequisites
- A server (Raspberry Pi, Old PC, Jetson) with **Docker** and **Docker Compose** installed.
- A **Static IP** or Dynamic DNS reachable from the internet.
- A Domain Name (recommended for automatic HTTPS) pointing to your Static IP.

## Part 1: Backend Deployment (Self-Hosted)

### 1. Prepare the Server
Clone the repository to your server:
```bash
git clone https://github.com/your-username/astrogator.git
cd astrogator
```

### 2. Configure Caddy (HTTPS)
The `Caddyfile` is already pre-configured for **`api.physbrain.dev`**.
Ensure your **Cloudflare DNS** is set up as follows:
- **Type**: `A`
- **Name**: `api`
- **Content**: `[Your Home Server Static IP]`
- **Proxy Status**: **DNS Only** (Use "Grey Cloud" initially to let Caddy handle Let's Encrypt. Orange Cloud works but requires strict SSL settings in Cloudflare).

### 3. Push to GitHub
I noticed your local repo doesn't have a remote configured yet.
```bash
# On your local machine (using SSH):
git remote add origin git@github.com:EMCollinsPhD/LostInSpace.git
# Or if origin exists but uses HTTPS:
# git remote set-url origin git@github.com:EMCollinsPhD/LostInSpace.git

git branch -M main
git push -u origin main
```

### 4. Download Kernels (On Server)
The Docker image mounts the `backend/kernels` directory...
```bash
python3 backend/fetch_kernels.py
```

### 5. Run with Docker Compose
Start the backend and proxy:
```bash
# Allow your GitHub Pages domain (or local dev) to access the API
export ALLOWED_ORIGIN="https://physbrain.dev"

docker compose up -d
```

### 5. Verify
Check that the backend is running:
```bash
curl https://your-domain.com/api/nav/bodies
```

---

## Part 2: Frontend Deployment (GitHub Pages)

### 1. Configure for Production
In `frontend/config.js`, verify that the `API_BASE` either points to your backend URL or relies on a build environment variable. Since `config.js` is static, you might want to edit it before building, or use a separate branch for prod.

**Option A (Manual Edit)**:
Edit `frontend/config.js`:
```javascript
export const API_BASE = 'https://your-domain.com'; // Point to your Caddy Backend
```

### 2. Build the Project
Run the Vite build command locally:
```bash
cd frontend
npm install
npm run build
```
This creates a `dist/` directory.

### 3. Deploy to GitHub Pages
You can deploy the `dist` folder using `gh-pages` or by pushing to a `gh-pages` branch.
```bash
# Example using git subtree (if dist is committed, which is not recommended usually)
# Better: Use a GitHub Action or manual upload.
```

**Recommended**: Use the "Deploy from Branch" setting in GitHub.
1. Make sure your `dist` folder contents are on the `gh-pages` branch.
2. Go to GitHub Repo Settings -> Pages -> Source: `gh-pages` / `root`.
3. **Custom Domain**: Enter `physbrain.dev`.

**Cloudflare DNS for Frontend**:
- **Type**: `CNAME`
- **Name**: `@` (Root)
- **Content**: `your-username.github.io`
- **Proxy Status**: **Proxied** (Orange Cloud is fine here).


---

## Maintenance

### Updating Code
```bash
git pull
docker compose build backend
docker compose up -d
```

### Updating Kernels
If new kernels are needed (rare), run `python3 backend/fetch_kernels.py` on the host and restart the container.
