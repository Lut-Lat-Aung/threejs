import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { World, Body, Box, Vec3 } from 'cannon-es';

// Set up the scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.1, 100);
camera.position.set(10, 10, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 5);
scene.add(dirLight);

// Physics world
const world = new World();
world.gravity.set(0, -9.82, 0);

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
const wallHeight = 100;
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

  renderer.render(scene, camera);
}
animate();


// UI button
const btn = document.createElement('button');
btn.textContent = '🎲 Roll Dice';
btn.style.cssText = 'position:fixed;top:20px;left:20px;font-size:20px;padding:10px;'; //always at the top left
btn.onclick = rollDice;
document.body.appendChild(btn);
