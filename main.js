import * as THREE from './build/three.module.js'
import { OrbitControls } from './examples/jsm/controls/OrbitControls.js'
import Stats from './examples/jsm/libs/stats.module.js'
import { GUI } from './examples/jsm/libs/dat.gui.module.js'
import Body from './scripts/body.js'
import Vector from './scripts/vector.js'

// --- Costanti ---------------------------------------------------------------

// Fattore di scala per disegno oggetti.
const scaleFactor = 10 / 6371000;
// Durata step calcoli fisici [ms]
const phisicsCalcStep = 300
// Universal gravitation constant
export const G = 6.67e-11;
// Durata step simulazione propagazione [s]
const simStepSize = 100;
// Numero step simulazione propagazione
const simStepNumber = 10000;

// --- Inizializzazione elementi fissi ----------------------------------------

// Inizializzazione videocamera
var camera = new THREE.PerspectiveCamera(45, 1, 1, 100000);
camera.position.z = 60;
camera.position.y = 80;
camera.position.x = -60;
camera.lookAt(0,0,0)

// Inizializzazione canvas
const canvas = document.querySelector('#c');
var renderer = new THREE.WebGLRenderer({canvas});

// Creazione scena
var scene = new THREE.Scene();

// Stats
const stats = Stats()
document.body.appendChild(stats.dom)

//Controls
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, 0);
controls.update();

// Luce ambientale
var light = new THREE.AmbientLight( 0x888888 )
scene.add(light)

// Luce direzionale
var light = new THREE.DirectionalLight( 0xfdfcf0, 1 )
light.position.set(20,10,20)
scene.add(light)

//Starfield
var starGeometry = new THREE.SphereGeometry(10000, 50, 50);
var starMaterial = new THREE.MeshPhongMaterial({
  map: new THREE.ImageUtils.loadTexture("./images/starfield.jpg"),
  side: THREE.DoubleSide,
  shininess: 0
});
var starField = new THREE.Mesh(starGeometry, starMaterial);
scene.add(starField);

// Axes helper
// var axesHelper = new THREE.AxesHelper(30);
// scene.add(axesHelper);

// ----------------------------------------------------------------------------

function resizeRendererToDisplaySizeIfNeeded(renderer) {
  
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const needResize = canvas.width !== width || canvas.height !== height;
  
  if (needResize) {
    renderer.setSize(width, height, false);
    const canvas = renderer.domElement;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();    
  }
  
}

/**
* Set the position of the mesh.
* @param {Body} body Corpo da posizionare.
* @param {number} [myScaleFactor] Fattore di scala.
*/
function setMeshPosition(body, myScaleFactor = scaleFactor){
  if (body == null){
    log.console.error('Tentativo di setMeshPosition con body nullo!');
    return;
  }
  if (body == null){
    log.console.error(`Tentativo di setMeshPosition (body ${body.name}) con mesh nullo!`);
    return;
  }
  body.mesh.position.x = body.position.x * myScaleFactor;
  body.mesh.position.y = body.position.y * myScaleFactor;
  body.mesh.position.z = body.position.z * myScaleFactor;
}

/**
* Returns final (position, velocity) array after time dt has passed.
* @param {Body[]} attractors Attractors influencing this object.
* @param {Vector} initialPosition Initial position.
* @param {Vector} initialVelocity Initial velocity.
* @param {Function} accFunction Acceleration function (attractors, position, velocity, deltaTime).
* @param {Number} dt Time step (seconds).
* @returns {Vector[]} Status vector [position, velocity]
* @see https://mtdevans.com/2013/05/fourth-order-runge-kutta-algorithm-in-javascript-with-demo/
*/
export function rk4(attractors, initialPosition, initialVelocity, accFunction, dt){
  
  let position1 = initialPosition.clone();
  let velocity1 = initialVelocity.clone();
  let acceleration1 = accFunction(attractors, position1, velocity1, 0);
  
  let position2 = initialPosition.add(velocity1.scale(0.5*dt));
  let velocity2 = initialVelocity.add(acceleration1.scale(0.5*dt));
  let acceleration2 = accFunction(attractors, position2, velocity2, dt/2);
  
  let position3 = initialPosition.add(velocity2.scale(0.5*dt));
  let velocity3 = initialVelocity.add(acceleration2.scale(0.5*dt));
  let acceleration3 = accFunction(attractors, position3, velocity3, dt/2);
  
  let position4 = initialPosition.add(velocity3.scale(dt));
  let velocity4 = initialVelocity.add(acceleration3.scale(dt));
  let acceleration4 = accFunction(attractors, position4, velocity4, dt);
  
  let finalPosition = position1.add(
    (
      velocity1
      .add(velocity2.scale(2))
      .add(velocity3.scale(2))
      .add(velocity4)
    ).scale(dt/6)
  );
      
  let finalVelocity = velocity1.add(
    (
      acceleration1
      .add(acceleration2.scale(2))
      .add(acceleration3.scale(2))
      .add(acceleration4)
    ).scale(dt/6)
  );
          
  return [finalPosition, finalVelocity];
          
}
        
/**
* Propagates the state vector of timestep seconds.
* @param {Vector} actualPosition Position of the orbiter.
* @param {Vector} actualVelocity Velocity of the orbiter.
* @param {Body[]} attractors Attractors inlfuencing this orbiter.
* @param {number} timestep Time step (in seconds).
* @return {Vector[]} New state [position, velocity]
*/
function propagate(actualPosition, actualVelocity, attractors, timestep){
  return rk4(attractors, actualPosition, actualVelocity, acceleration, timestep);
}

/**
* Acceleration function of a body in the future.
* @param {Body[]} attractors
* @param {Vector} position 
* @return {Vector} Acceleration.
*/
export function acceleration(attractors, position){
  
  return attractors
  .filter(attr => attr.SORadius != 0)
  .filter(attr => position.diff(attr.position).module() <= attr.SOIRadius)
  .map(attr => {
    let distVector = position.diff(attr.position);
    // Gravity force: G * bodyMass * earthMass / Math.pow(earthDistance, 2)
    // Gravity acceleration: earthDistNorm.minus().scale(gravityForce / bodyMass)
    // Gravity acc. does NOT depend from orbiter mass.		
    return distVector.norm().minus().scale(G * attr.mass / Math.pow(distVector.module(), 2));
  })
  .reduce((prev, curr) => prev.add(curr), new Vector())	
  
}
        
/**
* Inizializza la mesh lineare per disegnare la propagazione di una orbita.
* @param {*} scene
* @param {*} simSize Numero di step.
* @param {*} color Colore.
* @returns 
*/
function buildLineMesh(scene, simSize = 1000, color = 'red'){
  
  // Create mesh with fake points, because the BufferGeometry has to be
  // initialized with the right size.
  const newSimPoints = []
  for (let i = 0; i < simSize; i++){
    newSimPoints.push(new THREE.Vector3(0,0,0));
  }
  console.log(`Creati ${newSimPoints.length} simpoints`)
  const simGeometry = new THREE.BufferGeometry().setFromPoints(newSimPoints);
  const simMaterial = new THREE.LineBasicMaterial({ 
    color : color
  });
  
  const mesh = new THREE.Line( simGeometry, simMaterial );
  mesh.visible = false;
  scene.add(mesh);
  
  return mesh;
  
}
        
// --- Earth ------------------------------------------------------------------

var earth = new Body('Earth');
earth.mass = 5.972e24;
earth.radius = 6371e3;
earth.SOIRadius = 0.929e9;
earth.position = new Vector(0,0,0);
earth.velocity = new Vector(0,0,0);

// Costruzione mesh
let earthGeometry = new THREE.SphereGeometry( 
  earth.radius * scaleFactor, 
  50, 
  50 
);
let earthMaterial = new THREE.MeshPhongMaterial({
  map: new THREE.ImageUtils.loadTexture("./images/2k_earth_daymap.jpg"),
  color: 0xaaaaaa,
  specular: 0x333333,
  shininess: 5
});
earth.mesh = new THREE.Mesh(earthGeometry, earthMaterial);

scene.add(earth.mesh);
setMeshPosition(earth);

// --- Ship -------------------------------------------------------------------

var ship = new Body('Ship');
ship.mass = 100000;
ship.radius = 200000;

//ship.position = earth.position.add(new Vector(- earth.radius - 400e3, 0, 0));
ship.position = earth.calcSatellitePosition(400e3, -90, -30)
//ship.velocity = new Vector(0, -7660*Math.cos(56*2*Math.PI/360), -7660*Math.sin(56*2*Math.PI/360));
// ship.velocity = new Vector(0, 0, -10750+10)
ship.velocity = new Vector(0, 0, -7650+10)

//Create geometry and material
var shipGeometry = new THREE.SphereGeometry(200000 * scaleFactor, 50, 50 );
var shipMaterial = new THREE.MeshPhongMaterial({
  color: 0xaaaaaa
});
ship.mesh = new THREE.Mesh(shipGeometry, shipMaterial);

const shipLineMesh = buildLineMesh(scene, 10000, 'green');

scene.add(ship.mesh);
setMeshPosition(ship);

// ----------------------------------------------------------------------------

let simData = {
  deltaV: 2000
}
ship.velocity = ship.velocity.norm().scale(7650 + simData.deltaV);
const gui = new GUI()
const maneuverFolder = gui.addFolder("Ship maneuver")
// maneuverFolder.add(shipManeuver.deltaV, "x", -100, +100, 1).onChange(val => shipManeuver.deltaV.x = val)
// maneuverFolder.add(shipManeuver.deltaV, "y", -100, +100, 1).onChange(val => shipManeuver.deltaV.y = val)
// maneuverFolder.add(shipManeuver.deltaV, "z", -100, +100, 1).onChange(val => shipManeuver.deltaV.z = val)
maneuverFolder.add(simData, "deltaV", 0, +5000, 1).onChange((val) => {
  ship.velocity = ship.velocity.norm().scale(7650 + val);
})
maneuverFolder.open()

// ----------------------------------------------------------------------------

// Variabili per timekeeping (inizializzazione)
let lastIteration = Date.now();
let spentTime = 0;
let sinceLastPhysicsCalc = 0;

var render = function (actions) {
  
  // Checking time
  spentTime = Date.now() - lastIteration;
  sinceLastPhysicsCalc += spentTime;
  lastIteration = Date.now();	
  
  // Step calcoli fisici
  if (sinceLastPhysicsCalc > phisicsCalcStep){
    
    // Rotate earth
    earth.mesh.rotation.y += 2 * Math.PI / (24*60*60*1000) * sinceLastPhysicsCalc;
    
    // Propagate ship status
    let shipRes = propagate(ship.position, ship.velocity, [earth], sinceLastPhysicsCalc / 1000)
    ship.position = shipRes[0]
    ship.velocity = shipRes[1]
    setMeshPosition(ship);
    
    // Resetta tempo calcolo fisica
    sinceLastPhysicsCalc = 0;
    
    // Refresh orbit propagation
    let shipSim = ship.clone();
    for (let step = 0; step < simStepNumber; step++){
      
      let shipRes = propagate(shipSim.position, shipSim.velocity, [earth], simStepSize)
      
      shipSim.position = shipRes[0]
      shipSim.velocity = shipRes[1]
      
      let posArray = shipLineMesh.geometry.getAttribute('position').array;	
      posArray[step*3] = shipSim.position.x*scaleFactor;
      posArray[step*3+1] = shipSim.position.y*scaleFactor;
      posArray[step*3+2] = shipSim.position.z*scaleFactor;
      
    }
    shipLineMesh.geometry.setDrawRange(0, simStepNumber)
    shipLineMesh.geometry.attributes.position.needsUpdate = true;		
    shipLineMesh.visible = true;	
    
  }
  
  resizeRendererToDisplaySizeIfNeeded(renderer);
  renderer.render(scene, camera);
  stats.update()
  requestAnimationFrame(render);
  
};

render(); // Prima chiamata