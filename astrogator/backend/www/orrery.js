import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { API_BASE } from './config.js';

let scene, camera, renderer, controls;
let container;
let animationId;

export function initOrrery(containerId) {
  container = document.getElementById(containerId);
  if (!container) {
    console.error("Orrery container not found");
    return;
  }

  // 1. Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  // 2. Camera
  const width = container.clientWidth;
  const height = container.clientHeight;
  // Near plane lowered to ~150m (0.000001 AU) to prevent clipping
  camera = new THREE.PerspectiveCamera(45, width / height, 0.00000001, 1000);
  camera.position.set(0, 50, 100);

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // 4. Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 0.0000001; // Allow very close zoom
  controls.zoomSpeed = 2.0;

  // 5. Objects
  // Sun
  const sunGeo = new THREE.SphereGeometry(696340 * SOL_SCALE_FACTOR * ORBIT_SCALE, 32, 32);
  // Sun is huge (109x Earth). Visual scale controlled by SOL_SCALE_FACTOR
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  scene.add(sun);

  // Planet Container
  const planetContainer = new THREE.Group();
  scene.add(planetContainer);

  // Load Static Orbits
  fetch(`${API_BASE}/api/nav/orrery/static`)
    .then(res => res.json())
    .then(paths => {
      Object.entries(paths).forEach(([name, points]) => {
        createOrbitLine(name, points);
      });
    }).catch(err => console.error("Failed to load orbits:", err));

  // Initial Live Data
  fetchLiveData();

  // Grid
  const gridHelper = new THREE.GridHelper(200, 50, 0x333333, 0x111111);
  scene.add(gridHelper);

  // 6. Resize Handler
  window.addEventListener('resize', onWindowResize);

  // 7. Start Loop
  animate();

  // 8. Poll for updates
  setInterval(fetchLiveData, 60000); // Every minute
}

// Configuration
const ORBIT_SCALE = 1e-7; // 1 unit = 1,000,000 km
const SOL_SCALE_FACTOR = 1; // Exaggeration factor for Sun
const PLANET_SCALE_FACTOR = 1; // Exaggeration factor for planets
const PLANET_SIZES = {
  // km radius approx
  "MERCURY": 2439,
  "VENUS": 6051,
  "EARTH": 6371,
  "MARS": 3389,
  "JUPITER": 69911,
  "SATURN": 58232
};
const PLANET_COLORS = {
  "MERCURY": 0xaaaaaa,
  "VENUS": 0xe3bb76,
  "EARTH": 0x2233ff,
  "MARS": 0xff3300,
  "JUPITER": 0xbcafb2,
  "SATURN": 0xaebb99
};

const planetMeshes = {};

function createOrbitLine(name, points) {
  if (!points || points.length === 0) return;

  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  points.forEach(p => {
    vertices.push(p[0] * ORBIT_SCALE, p[2] * ORBIT_SCALE, -p[1] * ORBIT_SCALE); // Swap Y/Z for Three.js
  });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

  // Close the loop
  const material = new THREE.LineBasicMaterial({ color: 0x444444 });
  const line = new THREE.LineLoop(geometry, material);
  scene.add(line);
}

// Fleet Points System
let fleetPoints = null;

function createFleetTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');

  // Outer Glow/Border
  ctx.beginPath();
  ctx.arc(16, 16, 15, 0, 2 * Math.PI);
  ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
  ctx.fill();

  // Core Dot
  ctx.beginPath();
  ctx.arc(16, 16, 8, 0, 2 * Math.PI);
  ctx.fillStyle = '#00FF00';
  ctx.fill();

  // White Center for sharpness
  ctx.beginPath();
  ctx.arc(16, 16, 4, 0, 2 * Math.PI);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function fetchLiveData() {
  fetch(`${API_BASE}/api/nav/orrery/live`)
    .then(res => res.json())
    .then(data => {
      updatePlanets(data.bodies);
    })
    .catch(err => console.error("Orrery update failed:", err));

  // Admin Fleet Fetch
  const authId = localStorage.getItem('astro_id');
  const authToken = localStorage.getItem('astro_token');

  if (authId === 'admin') {
    fetch(`${API_BASE}/api/admin/fleet`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
      .then(res => res.json())
      .then(data => {
        updateFleet(data);
      })
      .catch(err => console.error("Fleet update failed:", err));
  }
}

function updateFleet(fleet) {
  if (!scene) return;

  const positions = [];

  Object.values(fleet).forEach(pos => {
    // Coordinate Mapping: X -> X, Z -> Y, Y -> -Z (Standard Orrery mapping here)
    positions.push(
      pos[0] * ORBIT_SCALE,
      pos[2] * ORBIT_SCALE,
      -pos[1] * ORBIT_SCALE
    );
  });

  const float32 = new Float32Array(positions);

  if (!fleetPoints) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(float32, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      map: createFleetTexture(),
      size: 20, // Pixel size
      sizeAttenuation: false,
      transparent: true,
      depthTest: false // Always visible? Maybe not, planets obstruct? Let's keep depthTest true usually.
    });

    fleetPoints = new THREE.Points(geo, mat);
    // Ensure it renders on top if needed?
    // fleetPoints.renderOrder = 999; 
    scene.add(fleetPoints);
  } else {
    // Update Geometry
    fleetPoints.geometry.setAttribute('position', new THREE.BufferAttribute(float32, 3));
    fleetPoints.geometry.attributes.position.needsUpdate = true;
  }
}

// Planet Points System
let planetPoints = null;

function createPlanetTexture(colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Halo
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, 2 * Math.PI);
  // Color with low opacity
  const c = new THREE.Color(colorHex);
  const r = Math.floor(c.r * 255);
  const g = Math.floor(c.g * 255);
  const b = Math.floor(c.b * 255);
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
  ctx.fill();

  // Core
  ctx.beginPath();
  ctx.arc(32, 32, 12, 0, 2 * Math.PI);
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fill();

  // White Center
  ctx.beginPath();
  ctx.arc(32, 32, 6, 0, 2 * Math.PI);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

// We need a single geometry for colors? 
// Actually, separate Points objects might be easier for different textures/colors if we don't want a texture atlas.
// But PointsMaterial takes ONE map and ONE color.
// If using vertexColors, we modulate the color.
// So we need a white texture!

function createGenericPlanetTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Gradient or Halo
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  return new THREE.CanvasTexture(canvas);
}

function updatePlanets(bodies) {
  if (!scene) return;

  // 1. Update Meshes
  Object.entries(bodies).forEach(([name, pos]) => {
    // Create mesh if missing
    if (!planetMeshes[name]) {
      const rad = (PLANET_SIZES[name] || 5000) * ORBIT_SCALE * PLANET_SCALE_FACTOR;
      const geo = new THREE.SphereGeometry(Math.max(rad, 1e-9), 32, 32);
      const mat = new THREE.MeshBasicMaterial({ color: PLANET_COLORS[name] || 0xffffff });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      planetMeshes[name] = mesh;
    }

    // Update Position
    planetMeshes[name].position.set(
      pos[0] * ORBIT_SCALE,
      pos[2] * ORBIT_SCALE,
      -pos[1] * ORBIT_SCALE
    );
  });

  // 2. Update Points (Sprites)
  // We include SUN here too (static at 0,0,0) so it gets a sprite
  // Build arrays for Position and Color
  const positions = [];
  const colors = [];

  // Add Sun (Center)
  positions.push(0, 0, 0);
  const sunC = new THREE.Color(0xffff00);
  colors.push(sunC.r, sunC.g, sunC.b);

  // Add Planets
  Object.entries(bodies).forEach(([name, pos]) => {
    positions.push(
      pos[0] * ORBIT_SCALE,
      pos[2] * ORBIT_SCALE,
      -pos[1] * ORBIT_SCALE
    );
    const c = new THREE.Color(PLANET_COLORS[name] || 0xffffff);
    colors.push(c.r, c.g, c.b);
  });

  const posAttr = new THREE.Float32BufferAttribute(positions, 3);
  const colAttr = new THREE.Float32BufferAttribute(colors, 3);

  if (!planetPoints) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', posAttr);
    geo.setAttribute('color', colAttr);

    const mat = new THREE.PointsMaterial({
      size: 40, // Pixel size (larger than fleet)
      sizeAttenuation: false,
      map: createGenericPlanetTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      depthTest: true // Critical for occlusion by spheres
    });

    planetPoints = new THREE.Points(geo, mat);
    // planetPoints.renderOrder = 0; // Standard
    scene.add(planetPoints);
  } else {
    planetPoints.geometry.setAttribute('position', posAttr);
    planetPoints.geometry.setAttribute('color', colAttr);
    planetPoints.geometry.attributes.position.needsUpdate = true;
    planetPoints.geometry.attributes.color.needsUpdate = true;
  }
}


function onWindowResize() {
  if (!camera || !renderer || !container) return;

  // Check if container is visible (has dimensions)
  if (container.clientWidth === 0 || container.clientHeight === 0) return;

  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
  animationId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Export a resize trigger for when the tab becomes active
export function triggerResize() {
  onWindowResize();
}
