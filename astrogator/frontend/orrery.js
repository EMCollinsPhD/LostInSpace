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
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
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
const SOL_SCALE_FACTOR = 5; // Exaggeration factor for Sun
const PLANET_SCALE_FACTOR = 50; // Exaggeration factor for planets
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

function fetchLiveData() {
  fetch(`${API_BASE}/api/nav/orrery/live`)
    .then(res => res.json())
    .then(data => {
      updatePlanets(data.bodies);
    })
    .catch(err => console.error("Orrery update failed:", err));
}

function updatePlanets(bodies) {
  if (!scene) return;

  Object.entries(bodies).forEach(([name, pos]) => {
    // Create mesh if missing
    if (!planetMeshes[name]) {
      const rad = (PLANET_SIZES[name] || 5000) * ORBIT_SCALE * PLANET_SCALE_FACTOR;
      const geo = new THREE.SphereGeometry(Math.max(rad, 0.1), 16, 16);
      const mat = new THREE.MeshBasicMaterial({ color: PLANET_COLORS[name] || 0xffffff });
      const mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      planetMeshes[name] = mesh;
    }

    // Update Position
    // SPICE: X, Y, Z (km) -> Three.js: X, Z, -Y (if Z is up in SPICE? Usually Z is North)
    // Standard SPICE J2000: X=V.Eq, Y=V.Eq+90, Z=North Pole.
    // Three.js Standard: Y is Up. 
    // So Map: Spice X -> Three X, Spice Z -> Three Y, Spice Y -> Three -Z? 
    // Let's stick to X->X, Z->Y (North Up), Y->-Z (Right Hand Rule consistency?)
    // Actually, simple mapping: X=X, Y=Z, Z=-Y

    planetMeshes[name].position.set(
      pos[0] * ORBIT_SCALE,
      pos[2] * ORBIT_SCALE,
      -pos[1] * ORBIT_SCALE
    );
  });
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
