import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdddddd);

// Camera
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 10, 10);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const light = new THREE.DirectionalLight(0xffffff, 0.8);
light.position.set(5, 10, 7);
scene.add(light);



// ======== Textures and Materials ==========

// Texture loader
const loader = new THREE.TextureLoader();
const wood = loader.load('/wood.jpg');
const brick = loader.load('/brick.jpg');
const metal = loader.load('/metal.jpg');
const world = loader.load('/world.jpg');
const monopolyBoard = loader.load('/monopoly-board.jpg');


// Box with wood texture
const box = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),
  new THREE.MeshStandardMaterial({ map: wood }), // texture
  // new THREE.MeshStandardMaterial({ color: 0xffffff }) // color 
);
box.position.x = -4;
scene.add(box);

// Box with multiple texture
const box2 = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),[
  new THREE.MeshStandardMaterial({ map: wood }), // texture
  new THREE.MeshStandardMaterial({ color: 0xeef99ff }), // texture
  new THREE.MeshStandardMaterial({ map: metal }), // texture
  new THREE.MeshStandardMaterial({ map: brick }), // texture
  new THREE.MeshStandardMaterial({ map: metal }), // texture
  new THREE.MeshStandardMaterial({ map: brick }), // texture
  ]
  // new THREE.MeshStandardMaterial({ color: 0xffffff }) // color 
);
box2.position.x = 4;
scene.add(box2);



// Sphere with brick texture
const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(1.2, 32, 32),
  new THREE.MeshStandardMaterial({ map: brick }), // texture
  // new THREE.MeshStandardMaterial({ color: 0xffffff }) // color 
);
scene.add(sphere);

// Sphere with wrold texture
const sphere1 = new THREE.Mesh(
  new THREE.SphereGeometry(1.2, 32, 32),
  new THREE.MeshStandardMaterial({ map: world }), // texture
  // new THREE.MeshStandardMaterial({ color: 0xffffff }) // color 
);
sphere1.position.x = 7;
scene.add(sphere1);

// Plane with metal texture
const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(15, 15),
  new THREE.MeshStandardMaterial({ map: monopolyBoard }), // texture
  // new THREE.MeshStandardMaterial({ color: 0xffffff }) // color 
);
plane.rotation.x = -Math.PI / 2;
plane.position.y = -1.5;
scene.add(plane);

// ========== End Textures and Materials ==========



// Animate
function animate() {
  requestAnimationFrame(animate);
  box.rotation.y += 0.01;
  box2.rotation.y += 0.01;
  sphere.rotation.y += 0.01;
  sphere1.rotation.y += 0.01;
  renderer.render(scene, camera);
}
animate();

// Responsive
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
