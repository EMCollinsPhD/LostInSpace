import { API_BASE, VERSION } from './config.js';
import { initOrrery, triggerResize } from './orrery.js';
// const SC_ID = 'student1'; // Removed: Dynamic based on login

// State
let currentState = null;
let starCatalog = []; // Local cache
let pollingInterval = null;

// Auth State
let auth = {
  id: localStorage.getItem('astro_id') || null,
  token: localStorage.getItem('astro_token') || null
};

// Camera State
let cam = {
  ra: 0,   // Center RA (deg)
  dec: 0,  // Center DEC (deg)
  fov: 60, // Field of View (deg)
  dragging: false,
  lastX: 0,
  lastY: 0
};

// Config
const PLANET_COLORS = {
  'SUN': 'yellow',
  'MERCURY': '#a1a1aa', // gray-400
  'VENUS': '#fde047', // yellow-300
  'EARTH': '#3b82f6', // blue-500
  'MARS': '#ef4444', // red-500
  'JUPITER': '#d97706', // amber-600 (tan)
  'SATURN': '#eab308', // yellow-500
  'URANUS': '#22d3ee', // cyan-400
  'NEPTUNE': '#3b82f6', // blue-500
  'PLUTO': '#94a3b8'  // slate-400
};
const PLANET_SIZES = {
  // km radius approx
  "SUN": 696340,
  "MERCURY": 2439,
  "VENUS": 6051,
  "EARTH": 6371,
  "MARS": 3389,
  "JUPITER": 69911,
  "SATURN": 58232,
  "URANUS": 25362,
  "NEPTUNE": 24622,
  "PLUTO": 1188
};
// DOM Elements
const els = {
  canvas: document.getElementById('star-tracker'),
  overlay: document.getElementById('tracker-overlay'),
  utcDisplay: document.getElementById('display-utc'),
  jdDisplay: document.getElementById('display-jd'),
  // fuelDisplay: document.getElementById('display-fuel'),
  camFov: document.getElementById('display-fov'),
  camRa: document.getElementById('display-ra'),
  camDec: document.getElementById('display-dec'),
  camTarget: document.getElementById('display-target'),
  /* inputs: {
    x: document.getElementById('input-dv-x'),
    y: document.getElementById('input-dv-y'),
    z: document.getElementById('input-dv-z'),
  }, */
  // statusMsg: document.getElementById('status-msg'),
  modal: document.getElementById('help-modal'),
};

// --- Initialization ---
function init() {
  // Canvas Sizing
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Event Listeners
  document.getElementById('btn-refresh').addEventListener('click', fetchData);
  document.getElementById('btn-help').addEventListener('click', () => toggleModal(true));
  document.getElementById('btn-close-help').addEventListener('click', () => toggleModal(false));
  document.getElementById('btn-ack-help').addEventListener('click', () => toggleModal(false));

  // Login Listener
  document.getElementById('btn-login').addEventListener('click', handleLogin);
  document.getElementById('btn-logout').addEventListener('click', logout);

  // Tab Listeners
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Canvas Interaction
  els.canvas.addEventListener('mousemove', handleCanvasMouseMove);
  els.canvas.addEventListener('mousedown', (e) => {
    cam.dragging = true;
    cam.lastX = e.clientX;
    cam.lastY = e.clientY;
    els.canvas.style.cursor = 'grabbing';
  });
  window.addEventListener('mouseup', () => {
    cam.dragging = false;
    els.canvas.style.cursor = 'crosshair';
  });
  els.canvas.addEventListener('wheel', handleCanvasWheel, { passive: false });

  // Boot sequence
  if (auth.id && auth.token) {
    // Authenticated -> Load
    startApp();
  } else {
    // Show Login
    document.getElementById('login-modal').classList.remove('hidden');
    document.getElementById('login-modal').style.display = 'flex';
  }
}

function startApp() {
  document.getElementById('login-modal').classList.add('hidden');
  document.getElementById('login-modal').style.display = 'none';

  // Update header
  document.querySelector('.version').innerText = `${VERSION} [${auth.id}]`;

  fetchStars().then(() => {
    fetchData();
    // Poll every 60s
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(fetchData, 60000);
  });
}

async function handleLogin() {
  const id = document.getElementById('login-id').value;
  const token = document.getElementById('login-token').value;
  const errEl = document.getElementById('login-error');

  if (!id || !token) {
    errEl.innerText = "Please enter both ID and Token";
    errEl.style.display = 'block';
    errEl.classList.remove('hidden');
    return;
  }

  // Verify by making a request
  try {
    const res = await fetch(`${API_BASE}/api/nav/state/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
      // Success
      auth.id = id;
      auth.token = token;
      localStorage.setItem('astro_id', id);
      localStorage.setItem('astro_token', token);
      errEl.classList.add('hidden');
      errEl.style.display = 'none';
      startApp();
    } else {
      throw new Error("Auth Failed");
    }
  } catch (e) {
    errEl.innerText = "Authentication Failed: Invalid ID or Token";
    errEl.style.display = 'block';
    errEl.classList.remove('hidden');
  }
}

function resizeCanvas() {
  const parent = els.canvas.parentElement;
  els.canvas.width = parent.clientWidth;
  els.canvas.height = parent.clientHeight;
  if (currentState) renderTracker(currentState);
}

function toggleModal(show) {
  if (show) els.modal.classList.remove('hidden');
  else els.modal.classList.add('hidden');
}

// --- API Interaction ---
async function fetchStars() {
  try {
    const res = await fetch(`${API_BASE}/api/nav/stars`);
    if (!res.ok) throw new Error('Failed to fetch star catalog');
    starCatalog = await res.json();
    console.log(`Loaded ${starCatalog.length} stars.`);
  } catch (e) {
    console.error("Star Catalog Error:", e);
    starCatalog = [];
  }
}



async function fetchData() {
  if (!auth.id) return;

  try {
    const res = await fetch(`${API_BASE}/api/nav/state/${auth.id}`, {
      headers: {
        'Authorization': `Bearer ${auth.token}`
      }
    });

    if (res.status === 401 || res.status === 403) {
      // Auth error, logout
      logout();
      return;
    }

    if (!res.ok) throw new Error('API Error');
    const data = await res.json();

    currentState = data;
    updateUI(data);
  } catch (e) {
    console.error("Fetch failed", e);
    els.utcDisplay.innerText = "CONN. ERROR";
    els.jdDisplay.innerText = "CONN. ERROR";
  }
}

function logout() {
  auth.id = null;
  auth.token = null;
  localStorage.removeItem('astro_id');
  localStorage.removeItem('astro_token');

  if (pollingInterval) clearInterval(pollingInterval);

  document.getElementById('login-modal').classList.remove('hidden');
  document.getElementById('login-modal').style.display = 'flex';
}

/* async function handleBurn() {
  const dv = {
    x: parseFloat(els.inputs.x.value) || 0,
    y: parseFloat(els.inputs.y.value) || 0,
    z: parseFloat(els.inputs.z.value) || 0,
  };

  try {
    const res = await fetch(`${API_BASE}/api/cmd/burn/${SC_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delta_v: dv,
        utc_time: currentState ? currentState.time.utc : ""
      })
    });

    if (res.ok) {
      showStatus("Engine Burn Executed.", "text-green-500");
      fetchData();
    } else {
      showStatus("Burn Failed.", "text-red-500");
    }
  } catch (e) {
    showStatus("Comm Error.", "text-red-500");
  }
} 

function showStatus(msg, colorClass) {
  els.statusMsg.innerText = msg;
  // Simple flash
  setTimeout(() => els.statusMsg.innerText = "", 3000);
} */

function updateUI(data) {
  // Temporarily disabled
  // els.fuelDisplay.innerText = data.fuel.toFixed(1);
  // Time updated by local ticker
  renderTracker(data);
}

// Local Clock Ticker (Independent of Fetch)
setInterval(() => {
  // Format: YYYY-MM-DD HH:MM:SS UTC
  const now = new Date();
  const iso = now.toISOString().replace('T', ' ').substring(0, 19);
  els.utcDisplay.innerText = iso;
  els.jdDisplay.innerText = now.getTime() / 86400000 + 2440587.5;
}, 1000);

// --- Star Tracker Logic ---

// Coordinate transformations
function deg2rad(d) { return d * Math.PI / 180; }
function rad2deg(r) { return r * 180 / Math.PI; }

function getRotMatrix(raDeg, decDeg) {
  const a = deg2rad(raDeg);
  const d = deg2rad(decDeg);

  const fx = Math.cos(d) * Math.cos(a);
  const fy = Math.cos(d) * Math.sin(a);
  const fz = Math.sin(d);

  const ux = -Math.sin(d) * Math.cos(a);
  const uy = -Math.sin(d) * Math.sin(a);
  const uz = Math.cos(d);

  const rx = fy * uz - fz * uy;
  const ry = fz * ux - fx * uz;
  const rz = fx * uy - fy * ux;

  return [
    [-rx, -ry, -rz],
    [ux, uy, uz],
    [fx, fy, fz]
  ];
}

function renderTracker(data) {
  const ctx = els.canvas.getContext('2d');
  const w = els.canvas.width;
  const h = els.canvas.height;

  // Clear
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, w, h);

  // Update Camera Telemetry DOM
  els.camFov.innerText = `${cam.fov.toFixed(1)}°`;
  els.camRa.innerText = `${cam.ra.toFixed(2)}°`;
  els.camDec.innerText = `${cam.dec.toFixed(2)}°`;

  // Camera Setup
  const rot = getRotMatrix(cam.ra, cam.dec);
  const scale = (w / 2) / Math.tan(deg2rad(cam.fov) / 2); // Pinhole scale

  function project(objRa, objDec) {
    const ra = deg2rad(objRa);
    const dec = deg2rad(objDec);
    const Px = Math.cos(dec) * Math.cos(ra);
    const Py = Math.cos(dec) * Math.sin(ra);
    const Pz = Math.sin(dec);

    const Cx = rot[0][0] * Px + rot[0][1] * Py + rot[0][2] * Pz;
    const Cy = rot[1][0] * Px + rot[1][1] * Py + rot[1][2] * Pz;
    const Cz = rot[2][0] * Px + rot[2][1] * Py + rot[2][2] * Pz;

    if (Cz <= 0) return null;

    return {
      x: (w / 2) + (Cx / Cz) * scale,
      y: (h / 2) - (Cy / Cz) * scale
    };
  }

  // Draw Stars (with reticle logic)
  let closestDist = Infinity;
  let closestName = "--";

  starCatalog.forEach(star => {
    // Simple cull before projection if possible? 
    const p = project(star.ra, star.dec);
    if (p) {
      if (p.x < -2 || p.x > w + 2 || p.y < -2 || p.y > h + 2) return;

      // Targeting
      const dx = p.x - (w / 2);
      const dy = p.y - (h / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 15 && dist < closestDist) {
        closestDist = dist;
        closestName = (star.name || "Unknown Star");
      }

      // Magnitude scaling based on phys.
      let r = 0;
      let alpha = 1.0;

      if (star.mag < 1.0) {
        r = 2.5 - (star.mag * 0.5);
        alpha = 1.0;
      } else if (star.mag < 3.0) {
        r = 1.5 - ((star.mag - 1.0) * 0.3);
        alpha = 0.9;
      } else {
        r = 1.0 - ((star.mag - 3.0) * 0.15);
        alpha = Math.max(0.3, 0.8 - ((star.mag - 3.0) * 0.2));
      }
      if (r < 0.6) r = 0.6; // Minimum visible pixel size

      // Color from B-V Index
      let fill = '#ffffff';
      if (typeof star.bv === 'number') {
        if (star.bv < 0.0) fill = '#9bb0ff';      // Blue-white
        else if (star.bv < 0.5) fill = '#cad7ff'; // White-blue
        else if (star.bv < 1.0) fill = '#f8f7ff'; // White
        else if (star.bv < 1.5) fill = '#fff4ea'; // Yellowish
        else if (star.bv < 2.0) fill = '#ffd2a1'; // Orange
        else fill = '#ffcc6f';                    // Red
      }

      ctx.fillStyle = fill;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1.0;

  // Update Target Display logic above handles closestName.

  // Draw Planets & Spacecraft
  data.observables.bodies.forEach(body => {
    const p = project(body.ra, body.dec);
    const BODIES = Object.keys(PLANET_COLORS);
    if (p) {
      // Different logic for Spacecraft vs Planets
      if (BODIES.includes(body.name)) {
        // Planet / Sun
        const color = PLANET_COLORS[body.name.toUpperCase()] || 'cyan';
        const isSun = body.name === 'SUN';

        ctx.fillStyle = color;
        const scale = isSun ? 0.000015 : 0.000075;
        const r = scale * PLANET_SIZES[body.name.toUpperCase()];

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
        ctx.fill();
        // If body is Saturn, draw rings as a thin ellipse
        if (body.name === 'SATURN') {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, r * 1.5, r * 0.7, 0, 0, 2 * Math.PI);
          ctx.stroke();
        }
      } else {
        // Spacecraft: Star-like appearance
        // Bright yellow-white
        ctx.fillStyle = '#fffee0';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#ffffff';

        // Size inversely proportional to range (if available)
        // Range is in KM.
        // Approx scaling: 10,000 km -> 3px radius.
        const range = body.range || 50000;

        let r = 30000 / (range + 1000);
        if (r > 6) r = 6;      // Max size limit
        if (r < 1.5) r = 1.5;  // Min visibility limit

        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
        ctx.fill();

        ctx.shadowBlur = 0; // Reset shadow

        // Label if relatively close?
        if (range < 100000) {
          ctx.fillStyle = 'rgba(255, 255, 224, 0.7)';
          ctx.font = '9px monospace';
          ctx.fillText(body.name, p.x + 2 * r, p.y + 2 * r);
        }
      }

      // Targeting Logic
      const dx = p.x - (w / 2);
      const dy = p.y - (h / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Priority to planets over stars? 
      // Let's say if within 20px, we select it.
      if (dist < 20 && dist < closestDist) {
        closestDist = dist;
        closestName = body.name;
      }
    }
  });

  if (els.camTarget) {
    els.camTarget.innerText = closestName;
    els.camTarget.className = (closestName !== "--") ? "text-cyan-500 font-bold" : "text-slate-500";
  }

  // Draw Crosshairs
  ctx.strokeStyle = '#22c55e'; // green-500
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 20, h / 2);
  ctx.lineTo(w / 2 + 20, h / 2);
  ctx.moveTo(w / 2, h / 2 - 20);
  ctx.lineTo(w / 2, h / 2 + 20);
  ctx.stroke();
}

function handleCanvasWheel(e) {
  e.preventDefault();
  let newFov = cam.fov + (e.deltaY * 0.05);
  if (newFov < 1) newFov = 1;
  if (newFov > 120) newFov = 120;

  cam.fov = newFov;
  if (currentState) renderTracker(currentState);
}

function handleCanvasMouseMove(e) {
  if (cam.dragging) {
    const dx = e.clientX - cam.lastX;
    const dy = e.clientY - cam.lastY;
    const degPerPx = cam.fov / els.canvas.height;

    cam.ra += -dx * degPerPx;
    cam.dec += dy * degPerPx;

    if (cam.ra < 0) cam.ra += 360;
    if (cam.ra >= 360) cam.ra -= 360;
    if (cam.dec > 90) cam.dec = 90;
    if (cam.dec < -90) cam.dec = -90;

    cam.lastX = e.clientX;
    cam.lastY = e.clientY;

    if (currentState) renderTracker(currentState);
  }
}

// Boot
window.onload = init;

function switchTab(tabId) {
  // Hide all contents
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  // Deactivate buttons
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  // Activate target
  document.getElementById(tabId).classList.remove('hidden');
  document.getElementById(tabId).classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');

  // Orrery Logic
  if (tabId === 'tab-overview') {
    if (!window.orreryInitialized) {
      initOrrery('orrery-container');
      window.orreryInitialized = true;
    }
    // Give the browser a moment to layout the div before resizing
    requestAnimationFrame(() => {
      triggerResize();
    });
  }

  // Resize canvas if needed when becoming visible
  if (tabId === 'tab-tracker') resizeCanvas();
}
