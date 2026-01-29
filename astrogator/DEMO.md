# Live Demo Runbook

Follow these steps to demo **Astrogator** on any computer (including locked-down Windows laptops).

## Prerequisites
- A GitHub account.
- Internet access on the demo machine.

## Step 1: Launch Codespace
1.  Log in to GitHub and navigate to the repository.
2.  Click the `< > Code` green button.
3.  Select the **Codespaces** tab.
4.  Click **Create codespace on main**.
5.  Wait for the environment to load.

> [!NOTE]
> The first time you load this, it will take ~2-3 minutes to build the environment and fetch the kernels. Watch the "Setting up..." logs in the bottom right if curious.

## Step 2: Start the Application
Once the terminal is ready (you see a command prompt), run:

```bash
docker compose up
```

## Step 3: Access the App
1.  Click the **Ports** tab (usually near the Terminal).
2.  Look for **Port 80 (caddy)**.
3.  Click the **Globe Icon** (Open in Browser) appearing next to it.
    - *Note: If Port 80 is not clickable, try Port 8000 to verify the backend is running.*

## Troubleshooting
- **Frontend not loading?** Ensure you are opening the URL for **Port 80**, not 8000. Caddy serves the frontend and proxies the API.
- **"Gateway Timeout"?** The backend might still be starting up. Wait 10 seconds and refresh.
- **Space limitation?** If Codespaces complains about disk space, run `docker system prune -a` to clear old images.
