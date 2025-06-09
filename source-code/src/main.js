import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { World, Body, Box, Vec3 } from 'cannon-es';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';

// Set up the scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(59, window.innerWidth/window.innerHeight, 0.1, 500);
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


// Load texture
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

loader.load('board_game_piece_-_bicycle.glb', (gltf) => {
  playerMesh = gltf.scene;
  //player color and scale
  playerMesh.traverse((child) => {
    if (child.isMesh) {
      child.material.color.set(0xffffff); // set player color to white
      child.material.metalness = 0.5; // add some metalness
      child.material.roughness = 0.5; // add some roughness
    }
  });
  playerMesh.scale.set(0.06, 0.06, 0.06); // scale down
  playerMesh.position.set(6.5, 0.1, 6.5); // starting "GO" position
  scene.add(playerMesh);
  targetPos = boardPositions[1]; // Start moving from GO to next

});

const boardPositions = [
  [6.5, 0.1, 6.5],  // GO
  [-6.5, 0.1, 6.5],  // next tile
  [-6.5, 0.1, -6.5],
  [6.5, 0.1, -6.5],
  // continue clockwise around the board...
];

let currentIndex = 0;

let targetPos = null;
let moveSpeed = 0.01; // smaller = slower


// Dice data
const dice = [];
const diceSize = 1;


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
    new THREE.MeshStandardMaterial({ visible: false }) // set visible or transparent
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
const arenaHalfSize = 5; // must match floor size (10x10)

// Back wall
createWall(0, wallHeight, -arenaHalfSize, arenaHalfSize, wallHeight, wallThickness);
// Front wall
createWall(0, wallHeight, arenaHalfSize, arenaHalfSize, wallHeight, wallThickness);
// Left wall
createWall(-arenaHalfSize, wallHeight, 0, wallThickness, wallHeight, arenaHalfSize);
// Right wall
createWall(arenaHalfSize, wallHeight, 0, wallThickness, wallHeight, arenaHalfSize);
//Roof wall
createWall(0, wallHeight + 0.1, 0, arenaHalfSize, wallThickness, arenaHalfSize, Math.PI / 2);

// Create monopoly board floor
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(15, 15),
  new THREE.MeshStandardMaterial({ map: new THREE.TextureLoader().load('monopoly-board.png') }) // Use monopoly board texture
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const floorBody = new Body({
  shape: new Box(new Vec3(30, 0.3, 15)), // x:30 , y:0.3, z:15
  // x and z is length and width of the floor, y is thickness or height
  type: Body.STATIC
});
floorBody.position.set(0, -0.1, 0);
world.addBody(floorBody);


// Roll Dice 
function rollDice() {
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
}

// Animate the scene
function animate() {
  requestAnimationFrame(animate);
  world.step(1 / 60);

  dice.forEach(({ mesh, body }) => {
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
  });
  worldSphere.rotation.y += 0.0005; // slow background spin
  renderer.render(scene, camera);

  if (playerMesh && targetPos) {
  const current = playerMesh.position;
  const target = new THREE.Vector3(...targetPos);
    
  const distance = current.distanceTo(target);
  if (distance > 0.05) {
    // Move toward target smoothly
    const direction = target.clone().sub(current).normalize().multiplyScalar(moveSpeed);
    playerMesh.position.add(direction);
  } else {
    // Snap to target and advance to next
    playerMesh.position.copy(target);
    currentIndex = (currentIndex + 1) % boardPositions.length;
    targetPos = boardPositions[currentIndex];
    
  }
}

}
animate();


// UI button
const btn = document.createElement('button');
btn.textContent = '🎲 Roll Dice';
btn.style.cssText = 'position:fixed;top:50px;left:50px;font-size:20px;padding:10px;'; //always at the top left
btn.onclick = rollDice;
document.body.appendChild(btn);

// Dev info
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
