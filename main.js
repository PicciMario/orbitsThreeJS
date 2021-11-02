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
// Universal gravitation constant [m^3 / (kg * s^2)]
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

// Axes helper ----------------------------------------------------------------

var axis = new THREE.AxesHelper(30);
scene.add(axis);

function createAxisLabel(label, font, x, y, z, color){

  const xGeo = new THREE.TextGeometry( label, {
    font: font,
    size: 1,
    height: .1,
    curveSegments: 6,
  });

  let  xMaterial = new THREE.MeshBasicMaterial({ color: color });
  let  xText = new THREE.Mesh(xGeo , xMaterial);
  
  xText.position.x = x
  xText.position.y = y
  xText.position.z = z
  xText.rotation.x = camera.rotation.x;
  xText.rotation.y = camera.rotation.y;
  xText.rotation.z = camera.rotation.z;
  scene.add(xText);  

  return xText

}

const loader = new THREE.FontLoader();
var xLabel, yLabel, zLabel
loader.load( 'fonts/helvetiker_regular.typeface.json', function(font){
  xLabel = createAxisLabel('X', font, 30, 0, 0, 'red')
  yLabel = createAxisLabel('Y', font, 0, 30, 0, 'green')
  zLabel = createAxisLabel('Z', font, 0, 0, 30, 'blue')
});

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
  //.filter(attr => position.diff(attr.position).module() <= attr.SOIRadius)
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
* @param {boolean} dashed 
* @returns 
*/
function buildLineMesh(scene, simSize, color = 'red', dashed = false){
  
  // Create mesh with fake points, because the BufferGeometry has to be
  // initialized with the right size.
  const newSimPoints = []
  for (let i = 0; i < simSize; i++){
    newSimPoints.push(new THREE.Vector3(0,0,0));
  }
  console.log(`Creati ${newSimPoints.length} simpoints`)
  const simGeometry = new THREE.BufferGeometry().setFromPoints(newSimPoints);

  let simMaterial;
  if(!dashed){
    simMaterial = new THREE.LineBasicMaterial({ 
      color : color
    });
  }
  else {
    simMaterial = new THREE.LineDashedMaterial({
      linewidth: 1,
      color: color,
      dashSize: .5,
      gapSize: .1
    })	  
  }

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

ship.position = earth.calcSatellitePosition(400e3, -90, 0)
ship.velocity = new Vector(0, 0, -7670)

ship.position = new Vector(earth.radius*3, 10000000, earth.radius*3)
ship.velocity = new Vector(0, 0, 3800)

//Create geometry and material
var shipGeometry = new THREE.SphereGeometry(200000 * scaleFactor, 50, 50 );
var shipMaterial = new THREE.MeshPhongMaterial({
  color: 0xaaaaaa
});
ship.mesh = new THREE.Mesh(shipGeometry, shipMaterial);

const shipLineMesh = buildLineMesh(scene, simStepNumber, 'green');

scene.add(ship.mesh);
setMeshPosition(ship);

function drawVector(start, vector){

	const lineMat = new THREE.LineBasicMaterial( { color: 0x0000ff } );

	const linePoints = [];
  linePoints.push( new THREE.Vector3( 
		start.x,
		start.y,
		start.z
	));
	linePoints.push( new THREE.Vector3( 
		start.x + vector.x,
		start.y + vector.y,
		start.z + vector.z
	));

	const lineGeometry = new THREE.BufferGeometry().setFromPoints( linePoints );	
	
  const lineMesh = new THREE.Line( lineGeometry, lineMat );

  scene.add(lineMesh)	

}

// ----------------------------------------------------------------------------

// let simData = {
//   deltaV: 2000
// }
// ship.velocity = ship.velocity.norm().scale(7670 + simData.deltaV);
// const gui = new GUI()
// const maneuverFolder = gui.addFolder("Ship maneuver")
// // maneuverFolder.add(shipManeuver.deltaV, "x", -100, +100, 1).onChange(val => shipManeuver.deltaV.x = val)
// // maneuverFolder.add(shipManeuver.deltaV, "y", -100, +100, 1).onChange(val => shipManeuver.deltaV.y = val)
// // maneuverFolder.add(shipManeuver.deltaV, "z", -100, +100, 1).onChange(val => shipManeuver.deltaV.z = val)
// maneuverFolder.add(simData, "deltaV", 0, +5000, 1).onChange((val) => {
//   ship.velocity = ship.velocity.norm().scale(7670 + val);
// })
// maneuverFolder.open()

// ----------------------------------------------------------------------------

// Simulazione orbita con parametri calcolati
let angleSteps = 36*2;
let orbitSim = buildLineMesh(scene, angleSteps, 'yellow', true)
scene.add(orbitSim)

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

  // Allineamento etichette assi
  if (xLabel){
    xLabel.rotation.x = camera.rotation.x;
    xLabel.rotation.y = camera.rotation.y;
    xLabel.rotation.z = camera.rotation.z;
  }
  if (yLabel){
    yLabel.rotation.x = camera.rotation.x;
    yLabel.rotation.y = camera.rotation.y;
    yLabel.rotation.z = camera.rotation.z;
  }
  if (zLabel){
    zLabel.rotation.x = camera.rotation.x;
    zLabel.rotation.y = camera.rotation.y;
    zLabel.rotation.z = camera.rotation.z;
  }
  
  // Step calcoli fisici
  if (sinceLastPhysicsCalc > phisicsCalcStep){

  // Initial state vector
  let v_0 = ship.velocity.module()
  let r_0 = ship.position.diff(earth.position).module()
  let angle_0 = ship.position.diff(earth.position).angle(ship.velocity)

  let M = earth.mass

  // Specific energy (Earth orbit)
  let specificEnergy = Math.pow(v_0, 2) / 2.0 - G * M / r_0
  document.getElementById('specificEnergyDiv').innerHTML = `Spec. Energy: ${(specificEnergy/1000).toLocaleString(undefined, {maximumFractionDigits:2})} KJ/Kg`

  // Semimajor axis
  let sma = - G * M / (2 * specificEnergy)
  document.getElementById('semimajAxisDiv').innerHTML = `Sma: ${(sma/1000).toLocaleString(undefined, {maximumFractionDigits:0})} km`

  // Orbit eccentricity
  let ecc = Math.sqrt(1+(
    (2 * Math.pow(v_0, 2) * Math.pow(r_0, 2) * Math.pow(Math.sin(angle_0), 2) * specificEnergy)
    /(Math.pow(G, 2) * Math.pow(M, 2))
  ))
  document.getElementById('eccDiv').innerHTML = `Ecc: ${(ecc).toFixed(4)}`

  // Orbit shape
  let apoapsis = (sma * (1 + ecc))
  let periapsis = (sma * (1 - ecc))
  document.getElementById('apoDiv').innerHTML = `ApD: ${((apoapsis - earth.radius)/1000).toLocaleString(undefined, {maximumFractionDigits:0})} km`
  document.getElementById('perDiv').innerHTML = `PeD: ${((periapsis - earth.radius)/1000).toLocaleString(undefined, {maximumFractionDigits:0})} km`

  // Orbital period
  let period = 2 * Math.PI * Math.sqrt(Math.pow(sma, 3) / (G * M))
  document.getElementById('periodoDiv').innerHTML = `T: ${(period/3600).toLocaleString(undefined, {maximumFractionDigits:2})} h`

	// Inclination
	// ship position cross velocity is a vector perpendiculat to the orbital plane!
	let rVect = ship.position.diff(earth.position).cross(ship.velocity)
	let i = Math.acos(rVect.y / rVect.module())
	document.getElementById('incl').innerHTML = `Incl: ${(i * 180 / Math.PI).toLocaleString(undefined, {maximumFractionDigits:2})} deg.`

	// Velocità
	let vApo = Math.sqrt(G * M * ((2/apoapsis)-(1/sma)))
	document.getElementById('vApo').innerHTML = `ApV: ${(vApo).toLocaleString(undefined, {maximumFractionDigits:0})} m/s`
	let vPer = Math.sqrt(G * M * ((2/periapsis)-(1/sma)))
	document.getElementById('vPer').innerHTML = `PeV: ${(vPer).toLocaleString(undefined, {maximumFractionDigits:0})} m/s`

	document.getElementById('vCur').innerHTML = `v: ${(v_0).toLocaleString(undefined, {maximumFractionDigits:0})} m/s`
	document.getElementById('rCur').innerHTML = `r: ${(r_0/1000).toLocaleString(undefined, {maximumFractionDigits:0})} km`

    // Simulate orbit from parameters
	let orbit_rotate = -(Math.PI/2)
    for (let angleStep = 0; angleStep < angleSteps; angleStep++){

      let theta = (angleStep * 360 / angleSteps) * Math.PI / 180;
        
      let r_theta = Math.pow(v_0 * r_0 * Math.sin(angle_0), 2) / (G * M * (1 + ecc * Math.cos(theta)))
      
      let posArray = orbitSim.geometry.getAttribute('position').array;	
      posArray[angleStep*3] = -r_theta * Math.cos(theta + orbit_rotate) * scaleFactor;
      posArray[angleStep*3+1] = .5;
      posArray[angleStep*3+2] = r_theta * Math.sin(theta + orbit_rotate) * scaleFactor;
      
    }
    orbitSim.geometry.setDrawRange(0, angleSteps)
    orbitSim.geometry.attributes.position.needsUpdate = true;		
    orbitSim.visible = true;	
    orbitSim.computeLineDistances();  
    
    // console.log(orbitSim.geometry.getAttribute('position').array)

    // Rotate earth
    earth.mesh.rotation.y += 2 * Math.PI / (24*60*60*1000) * sinceLastPhysicsCalc;
    
    // Propagate ship status
    // let shipRes = propagate(ship.position, ship.velocity, [earth], sinceLastPhysicsCalc / 1000)
    // ship.position = shipRes[0]
    // ship.velocity = shipRes[1]
    // setMeshPosition(ship);
    
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