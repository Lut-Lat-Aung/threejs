import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { World, Body, Box, Vec3 } from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';

// Set up the scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(59, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(10, 10, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// Physics world
const world = new World();
world.gravity.set(0, -9.82, 0);

// --- NEW: utility up vector once ---
const WORLD_UP = new THREE.Vector3(0, 1, 0);

// Load texture - background
const worldTexture = new THREE.TextureLoader().load('monoworld.png'); // or 'stars.jpg'

// Create huge inverted sphere
const worldGeo = new THREE.SphereGeometry(50, 64, 64);
const worldMat = new THREE.MeshBasicMaterial({
  map: worldTexture,
  side: THREE.BackSide // Invert normals so you see from inside
});
const worldSphere = new THREE.Mesh(worldGeo, worldMat);
scene.add(worldSphere);

// Load player model
const loader = new GLTFLoader();
let playerMesh;

// === Board path: 40 tiles (1 step per Monopoly square) ===
const TRACK = 6.5;                 // corner center from board center (you already used 6.5)
const STEP  = (TRACK * 2) / 10;    // distance corner→corner divided into 10 squares
const Y     = 0.1;

const boardPositions = [];

// 0: GO (corner)
boardPositions.push([+TRACK, Y, +TRACK]);

// 1..9: bottom edge moving left, stop BEFORE Jail
for (let i = 1; i <= 9; i++) {
  boardPositions.push([+TRACK - STEP * i, Y, +TRACK]);
}

// 10..20: left edge (INCLUDE both corners: Jail and Free Parking)
for (let i = 0; i <= 10; i++) {
  boardPositions.push([-TRACK, Y, +TRACK - STEP * i]);
}

// 21..30: top edge (start AFTER Free Parking, end AT Go To Jail)
for (let i = 1; i <= 10; i++) {
  boardPositions.push([-TRACK + STEP * i, Y, -TRACK]);
}

// 31..39: right edge (start AFTER Go To Jail, stop BEFORE GO -> Boardwalk)
for (let i = 1; i <= 9; i++) {
  boardPositions.push([+TRACK, Y, -TRACK + STEP * i]);
}

// Sanity: boardPositions.length === 40 (0..39)


let currentIndex = 0;

// --- CHANGED: movement control state ---
let targetPos = null;
let moveSpeed = 0.04;          // little faster so it feels snappier
let stepsToMove = 0;           // how many tiles remain to move this turn
let isStepping = false;        // whether we’re currently moving toward a tile

loader.load('board_game_piece_-_bicycle.glb', (gltf) => {
  playerMesh = gltf.scene;
  // player color and scale
  playerMesh.traverse((child) => {
    if (child.isMesh) {
      child.material.color.set(0xffffff);
      child.material.metalness = 0.5;
      child.material.roughness = 0.5;
    }
  });
  playerMesh.scale.set(0.06, 0.06, 0.06);
  playerMesh.position.fromArray(boardPositions[0]); // start exactly at GO
  scene.add(playerMesh);
});

// Dice data
const dice = [];
const diceSize = 1;

// --- NEW: face mapping logic ---------------------------------------
// BoxGeometry uses material indices in this order: +X, -X, +Y, -Y, +Z, -Z (0..5).
// You loaded textures as [1,2,3,4,5,6] in that same order. So:
//   0:+X→1, 1:-X→2, 2:+Y→3, 3:-Y→4, 4:+Z→5, 5:-Z→6
// If your texture order is different, just change this array to match.
const FACE_VALUES = [1, 2, 3, 4, 5, 6];

// For detecting which face points up, we compare the world-space normals of each face with (0,1,0).
// The six local face normals for a unit cube:
const FACE_NORMALS_LOCAL = [
  new THREE.Vector3(1, 0, 0),   // +X (index 0)
  new THREE.Vector3(-1, 0, 0),  // -X (index 1)
  new THREE.Vector3(0, 1, 0),   // +Y (index 2)
  new THREE.Vector3(0, -1, 0),  // -Y (index 3)
  new THREE.Vector3(0, 0, 1),   // +Z (index 4)
  new THREE.Vector3(0, 0, -1),  // -Z (index 5)
];

// Returns 1..6 for this die mesh based on which face normal is most aligned with +Y
function getDieValue(mesh) {
  const q = mesh.quaternion;
  let bestDot = -Infinity;
  let bestFace = 0;

  // rotate each local normal by mesh quaternion to world
  for (let i = 0; i < 6; i++) {
    const n = FACE_NORMALS_LOCAL[i].clone().applyQuaternion(q);
    const d = n.dot(WORLD_UP);
    if (d > bestDot) {
      bestDot = d;
      bestFace = i; // material/face index
    }
  }
  return FACE_VALUES[bestFace];
}
// -------------------------------------------------------------------

// Create dice (mesh + cannon body)
function createDice(position = new Vec3(0, 5, 0)) {
  const geometry = new THREE.BoxGeometry(diceSize, diceSize, diceSize);
  const materials = [
    new THREE.MeshStandardMaterial({ map: new THREE.TextureLoader().load('one.png') }),
    new THREE.MeshStandardMaterial({ map: new THREE.TextureLoader().load('two.png') }),
    new THREE.MeshStandardMaterial({ map: new THREE.TextureLoader().load('three.png') }),
    new THREE.MeshStandardMaterial({ map: new THREE.TextureLoader().load('four.png') }),
    new THREE.MeshStandardMaterial({ map: new THREE.TextureLoader().load('five.png') }),
    new THREE.MeshStandardMaterial({ map: new THREE.TextureLoader().load('six.png') }),
  ];
  const mesh = new THREE.Mesh(geometry, materials);
  scene.add(mesh);

  const shape = new Box(new Vec3(0.5, 0.5, 0.5));
  const body = new Body({ mass: 1, shape });
  body.position.copy(position);
  world.addBody(body);

  dice.push({ mesh, body });
}

// Add two dice to the scene
createDice(new Vec3(-1, 5, 0));
createDice(new Vec3(1, 5, 0));

// Create walls around the arena to prevent dice from falling off
function createWall(x, y, z, sizeX, sizeY, sizeZ, rotY = 0) {
  const wallMesh = new THREE.Mesh(
    new THREE.BoxGeometry(sizeX * 2, sizeY * 2, sizeZ * 2),
    new THREE.MeshStandardMaterial({ visible: false }) // invisible walls
  );
  wallMesh.position.set(x, y, z);
  wallMesh.rotation.y = rotY;
  scene.add(wallMesh);

  // Physics of wall
  const wallShape = new Box(new Vec3(sizeX, sizeY, sizeZ));
  const wallBody = new Body({ mass: 0, shape: wallShape, type: Body.STATIC });
  wallBody.position.set(x, y, z);
  world.addBody(wallBody);
}

// Arena walls
const wallHeight = 7;
const wallThickness = 0.2;
const arenaHalfSize = 5;

// Back wall
createWall(0, wallHeight, -arenaHalfSize, arenaHalfSize, wallHeight, wallThickness);
// Front wall
createWall(0, wallHeight, arenaHalfSize, arenaHalfSize, wallHeight, wallThickness);
// Left wall
createWall(-arenaHalfSize, wallHeight, 0, wallThickness, wallHeight, arenaHalfSize);
// Right wall
createWall(arenaHalfSize, wallHeight, 0, wallThickness, wallHeight, arenaHalfSize);
// Roof wall
createWall(0, wallHeight + 0.1, 0, arenaHalfSize, wallThickness, arenaHalfSize, Math.PI / 2);

// Create monopoly board floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(15, 15),
  new THREE.MeshStandardMaterial({ map: new THREE.TextureLoader().load('monopoly-board.png') })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const floorBody = new Body({
  shape: new Box(new Vec3(30, 0.3, 15)), // keep your config
  type: Body.STATIC
});
floorBody.position.set(0, -0.1, 0);
world.addBody(floorBody);

// --- NEW: HUD for dice values --------------------------------------
const hud = document.createElement('div');
hud.style.cssText = `
  position: fixed; top: 50px; right: 50px;
  background: rgba(0,0,0,0.55); color:#fff; padding: 10px 14px;
  border-radius:10px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; 
  line-height:1.4; font-size:14px; z-index: 120;
`;
hud.innerHTML = `Die A: -<br>Die B: -<br><b>Total:</b> -`;
document.body.appendChild(hud);

function setHUD(a, b, total) {
  hud.innerHTML = `Die A: ${a}<br>Die B: ${b}<br><b>Total:</b> ${total}`;
}
// -------------------------------------------------------------------

// Roll Dice 
function rollDice() {
  // stop any pending move until new roll resolves
  stepsToMove = 0;
  targetPos = null;
  isStepping = false;

  dice.forEach(({ body }) => {
    body.velocity.set(
      (Math.random() - 0.5) * 10,
      Math.random() * 5 + 5,
      (Math.random() - 0.5) * 10
    );
    body.angularVelocity.set(
      Math.random() * 10,
      Math.random() * 10,
      Math.random() * 10
    );
  });

  // After the toss, wait until both dice settle, then read & move
  waitForDiceSettle().then(({ v1, v2, total }) => {
    setHUD(v1, v2, total);
    stepsToMove = total;

    // if piece exists and we have a path, kick off first step
    if (playerMesh && stepsToMove > 0) {
      // prime first target
      targetPos = nextTile();
      isStepping = true;
    }
  });
}

// --- NEW: Poll until dice are "sleeping", then read values ----------
function waitForDiceSettle() {
  // thresholds tuned to feel right; adjust if needed
  const LIN_THR = 0.05;
  const ANG_THR = 0.05;
  const STABLE_NEEDED = 18; // number of consecutive stable frames

  return new Promise((resolve) => {
    let stableCount = 0;

    function check() {
      const allStill = dice.every(({ body }) => {
        const v = body.velocity, w = body.angularVelocity;
        return (
          Math.abs(v.x) < LIN_THR &&
          Math.abs(v.y) < LIN_THR &&
          Math.abs(v.z) < LIN_THR &&
          Math.abs(w.x) < ANG_THR &&
          Math.abs(w.y) < ANG_THR &&
          Math.abs(w.z) < ANG_THR
        );
      });

      if (allStill) {
        stableCount++;
      } else {
        stableCount = 0;
      }

      if (stableCount >= STABLE_NEEDED) {
        // read face-up values now that they’re stable
        const v1 = getDieValue(dice[0].mesh);
        const v2 = getDieValue(dice[1].mesh);
        resolve({ v1, v2, total: v1 + v2 });
      } else {
        requestAnimationFrame(check);
      }
    }

    requestAnimationFrame(check);
  });
}
// -------------------------------------------------------------------

// Helper: compute the next board index & target position
function nextTile() {
  currentIndex = (currentIndex + 1) % boardPositions.length;
  return boardPositions[currentIndex];
}

// Animate the scene
function animate() {
  requestAnimationFrame(animate);
  world.step(1 / 60);

  // sync dice meshes to physics
  dice.forEach(({ mesh, body }) => {
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
  });

  // background
  worldSphere.rotation.y += 0.0005;

  // --- CHANGED: stepwise movement only when stepsToMove > 0 ----------
  if (playerMesh && isStepping && targetPos) {
    const current = playerMesh.position;
    const target = new THREE.Vector3().fromArray(targetPos);
    const distance = current.distanceTo(target);

    if (distance > 0.05) {
      // Move toward target
      const dir = target.clone().sub(current).normalize().multiplyScalar(moveSpeed);
      playerMesh.position.add(dir);

      // Optional: face movement direction a bit
      const look = target.clone();
      look.y = playerMesh.position.y;
      playerMesh.lookAt(look);
    } else {
      // Snap to target, decrement remaining steps
      playerMesh.position.copy(target);
      stepsToMove--;

      if (stepsToMove > 0) {
        targetPos = nextTile();
      } else {
        // done with this turn
        isStepping = false;
        targetPos = null;
      }
    }
  }
  // -------------------------------------------------------------------

  renderer.render(scene, camera);
}
animate();

// UI button
const btn = document.createElement('button');
btn.textContent = '🎲 Roll Dice';
btn.style.cssText = 'position:fixed;top:50px;left:50px;font-size:20px;padding:10px;z-index:110;';
btn.onclick = rollDice;
document.body.appendChild(btn);

// Dev info (unchanged)
const badge = document.createElement('div');
badge.innerHTML = `
  <div style="
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(97, 97, 97, 0.6);
    color: white;
    padding: 10px 15px;
    border-radius: 10px;
    position: fixed;
    bottom: 20px;
    left: 20px;
    font-family: sans-serif;
    z-index: 100;
  ">
    <span style="font-size: 16px;">👨‍💻 Lut Lat Aung</span>
    <a href="https://github.com/Lut-Lat-Aung" target="_blank">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg" width="24" alt="GitHub" />
    </a>
    <a href="https://www.linkedin.com/in/lut-lat-aung-48b53828b/" target="_blank">
      <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/linkedin/linkedin-original.svg" width="24" alt="LinkedIn" />
    </a>
  </div>
`;
document.body.appendChild(badge);

// --- OPTIONAL: handle resize (nice to have) ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
