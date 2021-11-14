import * as THREE from './build/three.module.js'
import { OrbitControls } from './examples/jsm/controls/OrbitControls.js'
import Stats from './examples/jsm/libs/stats.module.js'
import { GUI } from './examples/jsm/libs/dat.gui.module.js'
import Body from './scripts/body.js'
import Vector from './scripts/vector.js'
import {orbitalCalcBody} from './scripts/orbit-calc.js'

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
var camera = new THREE.PerspectiveCamera(30, 1, 1, 100000);
camera.position.z = 60;
camera.position.y = 0//80;
camera.position.x = 0//-60;
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
controls.mouseButtons = {
	LEFT: null,
	MIDDLE: THREE.MOUSE.PAN, //THREE.MOUSE.DOLLY
	RIGHT: THREE.MOUSE.ROTATE,
}
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

  let xMaterial = new THREE.MeshBasicMaterial({ color: color });
  let xText = new THREE.Mesh(xGeo , xMaterial);
  
  xText.position.x = x
  xText.position.y = y
  xText.position.z = z
  xText.rotation.x = camera.rotation.x;
  xText.rotation.y = camera.rotation.y;
  xText.rotation.z = camera.rotation.z;

  return xText

}

const loader = new THREE.FontLoader();
var xLabel, yLabel, zLabel
loader.load( 'fonts/helvetiker_regular.typeface.json', function(font){
  xLabel = createAxisLabel('X', font, 30, 0, 0, 'red')
  scene.add(xLabel)
  yLabel = createAxisLabel('Y', font, 0, 30, 0, 'green')
  scene.add(yLabel)
  zLabel = createAxisLabel('Z', font, 0, 0, 30, 'blue')
  scene.add(zLabel)
});

// ----------------------------------------------------------------------------

function resizeRendererToDisplaySizeIfNeeded(renderer, camera) {
  
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

  if (body.speedMesh == null) return;
  
  body.speedMesh.setDirection(
    new THREE.Vector3(
      body.velocity.x,
      body.velocity.y,
      body.velocity.z
    ).normalize()    
  )

  body.speedMesh.position.x = body.position.x * myScaleFactor;
  body.speedMesh.position.y = body.position.y * myScaleFactor;
  body.speedMesh.position.z = body.position.z * myScaleFactor;

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
function buildLineMesh(simSize, color = 'red', dashed = false){
  
  // Create mesh with fake points, because the BufferGeometry has to be
  // initialized with the right size.
  const newSimPoints = []
  for (let i = 0; i < simSize; i++){
    newSimPoints.push(new THREE.Vector3(0,0,0));
  }

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

// Meccanismo di selezione di casi di test
let orbitTests = [
	{
		desc: 'Zero',
		position: earth.calcSatellitePosition(400e3, 0, 0),
		velocity: new Vector(-7670-2500, 1000, 0)//.add(new Vector(-100, 1000, -1000)).add(new Vector(0, 1000, -100))
	},
	{
		desc: 'Uno',
		position: earth.calcSatellitePosition(400e3, 0, 0),
		velocity: new Vector(-7670-2500, -1000, 0) 		
	},
  {
    desc: 'Due',
    position: earth.calcSatellitePosition(400e3, 0, 0),
    velocity: new Vector(7670+2500, 1000, 0)    
  },
  {
    desc: 'Tre',
    position: earth.calcSatellitePosition(400e3, 0, 0),
    velocity: new Vector(7670+2500, -1000, 0)     
  },
  {
    desc: 'Quattro',
    position: new Vector(earth.radius*2, 10000000, earth.radius*1.8),
    velocity: new Vector(2200, 0, 5500)    
  },
  {
    desc: 'Cinque',
    position: earth.calcSatellitePosition(400e3, 80, -40),
    velocity: new Vector(0, 1000, -7670-2500)    
  },
  {
    desc: 'Eq. Circ.',
    position: earth.calcSatellitePosition(400e3, 0, 0),
    velocity: new Vector(-7670, 0, 0)    
  }  
]

orbitTests.forEach(({desc, position, velocity}, i) => {
  let id = `orbitTest${i}`
	let newDiv = document.createElement('div')
  newDiv.id = id
	newDiv.innerHTML = desc
	newDiv.classList.add('orbit')
	newDiv.addEventListener('click', function (event) {
    ship.position = position
    ship.velocity = velocity
    Array.from(document.getElementsByClassName("orbits-selected")).forEach(
      elem => elem.classList.remove('orbits-selected')
    )
    document.getElementById(id).classList.add('orbits-selected')
	});
	document.getElementById('orbitsSelector').appendChild(newDiv)
})
ship.position = orbitTests[0]['position']
ship.velocity = orbitTests[0]['velocity']
document.getElementById('orbitTest0').classList.add('orbits-selected')


//Create geometry and material
var shipGeometry = new THREE.SphereGeometry(200000 * scaleFactor, 50, 50 );
var shipMaterial = new THREE.MeshPhongMaterial({
  color: 'lightgreen',
  transparent: true,
  opacity: .8
});
ship.mesh = new THREE.Mesh(shipGeometry, shipMaterial);
ship.speedMesh = new THREE.ArrowHelper(
  new THREE.Vector3(
    ship.velocity.x,
    ship.velocity.y,
    ship.velocity.z
  ).normalize(),
  new THREE.Vector3(
    ship.position.x * scaleFactor,
    ship.position.y * scaleFactor,
    ship.position.z * scaleFactor
  ),
  2,
  "red"
)

const shipLineMesh = buildLineMesh(simStepNumber, 'green');
scene.add(shipLineMesh)

scene.add(ship.mesh);
scene.add(ship.speedMesh);
setMeshPosition(ship);

// ----------------------------------------------------------------------------

function drawVector(start, vector, color = "yellow"){

	const lineMat = new THREE.LineBasicMaterial( { color: color } );

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

// const geometry = new THREE.PlaneGeometry(10/scaleFactor, 10/scaleFactor);
// const material = new THREE.MeshBasicMaterial( {color: 0xffff00, side: THREE.DoubleSide, opacity: .41, transparent: true} );
// const plane = new THREE.Mesh( geometry, material );
// plane.rotation.x = Math.PI / 2
// scene.add( plane );

// ----------------------------------------------------------------------------

// Simulazione orbita con parametri calcolati
let angleSteps = 36*2;
let orbitSim = buildLineMesh(angleSteps, 'yellow', true)
scene.add(orbitSim)

// ----------------------------------------------------------------------------

// Variabili per timekeeping (inizializzazione)
let lastIteration = Date.now();
let spentTime = 0;
let sinceLastPhysicsCalc = 0;

function alignToCamera(item, camera){
  if (item && camera){
    item.rotation.x = camera.rotation.x;
    item.rotation.y = camera.rotation.y;
    item.rotation.z = camera.rotation.z;
  }
}

// ----- debug prova raycaster --------------------------------------

window.addEventListener('click', onDocumentMouseDown, false);
var raycaster = new THREE.Raycaster();
raycaster.linePrecision = 0.2;
var mouse = new THREE.Vector2();
function onDocumentMouseDown( event ) {
	event.preventDefault();
	mouse.x = ( event.clientX / renderer.domElement.clientWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / renderer.domElement.clientHeight ) * 2 + 1;
	raycaster.setFromCamera( mouse, camera );
	var intersects = raycaster.intersectObjects([shipLineMesh]);
	if (intersects.length > 0){
    console.log(intersects[0])
		let point = intersects[0].point
    var pointGeometry = new THREE.SphereGeometry(100000 * scaleFactor, 50, 50 );
    var pointMaterial = new THREE.MeshPhongMaterial({
      color: 'lightgreen',
      transparent: true,
      opacity: .8
    });
    let pointMesh = new THREE.Mesh(pointGeometry, pointMaterial)
    pointMesh.position.x = point.x
    pointMesh.position.y = point.y
    pointMesh.position.z = point.z
    scene.add(pointMesh)
	}
}

// -----------------------------------------------------------------

// Maneuvers
let maneuvers = [
  {
    time: new Date(new Date().getTime() + 10000),
    deltaV: new Vector(-100, 1000, -1000)
  },
  {
    time: new Date(new Date().getTime() + 20000),
    deltaV: new Vector(0, 1000, -100)
  }  
]

// Stampa elenco manovre
maneuvers.forEach((maneuver, i) => maneuver['id'] = `man${i}`)
maneuvers.forEach(({time, deltaV, id}) => {

	let newDiv = document.createElement('div')
  newDiv.id = id
  newDiv.classList.add('maneuverToDo')

  let printTime = new Date(time).toLocaleString()
  let printDeltaV = `x: ${deltaV.x}, y: ${deltaV.y}, z: ${deltaV.z},`
	newDiv.innerHTML = `- ${printTime} ${printDeltaV}`

  document.getElementById('maneuvers').appendChild(newDiv)

})

// -----------------------------------------------------------------

// Refresh orbital parameters div
// function refreshOrbitalParamsUI(calcOrbit, earth){

//   orbitalParamsListUI = [
//     {div: 'specificEnergyDiv', label: 'Spec. Energy', val: calcOrbit.specificEnergy, type: 'fraction', digits: 2},
//     {div: 'semimajAxisDiv', label: 'Sma', val: calcOrbit.semiMajorAxis/1000, type: 'fraction', digits: 2},
//     {div: 'eccDiv', label: 'Ecc', val: calcOrbit.eccentricity, type: 'fixed', digits: 2},
//     {div: 'apoDiv', label: 'ApD', val: (calcOrbit.rApoapsis - earth.radius)/1000, type: 'fixed', digits: 0},
//     {div: 'perDiv', label: 'PeD', val: (calcOrbit.rPeriapsis - earth.radius)/1000, type: 'fixed', digits: 0},
//     {div: 'periodoDiv', label: 'T', val: calcOrbit.period/3600, type: 'fixed', digits: 0},
//   ]

//   document.getElementById('specificEnergyDiv').innerHTML = `Spec. Energy: ${(specificEnergy/1000).toLocaleString(undefined, {maximumFractionDigits:2})} KJ/Kg`
//   document.getElementById('semimajAxisDiv').innerHTML = `Sma: ${(semiMajorAxis/1000).toLocaleString(undefined, {maximumFractionDigits:0})} km`
//   document.getElementById('eccDiv').innerHTML = `Ecc: ${(eccentricity).toFixed(4)}`
//   document.getElementById('eccDiv').innerHTML = `Ecc: ${(eccentricity).toFixed(4)}`
//   document.getElementById('apoDiv').innerHTML = `ApD: ${((rApoapsis - earth.radius)/1000).toLocaleString(undefined, {maximumFractionDigits:0})} km`
//   document.getElementById('perDiv').innerHTML = `PeD: ${((rPeriapsis - earth.radius)/1000).toLocaleString(undefined, {maximumFractionDigits:0})} km`
//   document.getElementById('periodoDiv').innerHTML = `T: ${(period/3600).toLocaleString(undefined, {maximumFractionDigits:2})} h`
//   document.getElementById('incl').innerHTML = `Incl: ${(inclination * 180 / Math.PI).toLocaleString(undefined, {maximumFractionDigits:2})} deg.`
//   document.getElementById('longAsc').innerHTML = `LonAsc: ${(longAscNode * 180 / Math.PI).toLocaleString(undefined, {maximumFractionDigits:2})} deg.`
//   document.getElementById('argPer').innerHTML = `Arg.per: ${(argPeriapsis * 180 / Math.PI).toLocaleString(undefined, {maximumFractionDigits:2})} deg.`
//   document.getElementById('vApo').innerHTML = `ApV: ${(vApoapsis).toLocaleString(undefined, {maximumFractionDigits:0})} m/s`
//   document.getElementById('vPer').innerHTML = `PeV: ${(vPeriapsis).toLocaleString(undefined, {maximumFractionDigits:0})} m/s`
//   document.getElementById('vCur').innerHTML = `v: ${(ship.velocity.module()).toLocaleString(undefined, {maximumFractionDigits:0})} m/s`
//   document.getElementById('rCur').innerHTML = `r: ${((ship.position.diff(earth.position).module())/1000).toLocaleString(undefined, {maximumFractionDigits:0})} km`
//   document.getElementById('dCur').innerHTML = `h: ${((ship.position.diff(earth.position).module()-earth.radius)/1000).toLocaleString(undefined, {maximumFractionDigits:0})} km`
//   document.getElementById('thetaCur').innerHTML = `theta: ${(angle_0*180/Math.PI).toLocaleString(undefined, {maximumFractionDigits:1})} deg.`  
// }

// -----------------------------------------------------------------

var render = function (actions) {
  
  // Checking time
  spentTime = Date.now() - lastIteration;
  sinceLastPhysicsCalc += spentTime;
  lastIteration = Date.now();	

  // Allineamento etichette assi
  alignToCamera(xLabel, camera)
  alignToCamera(yLabel, camera)
  alignToCamera(zLabel, camera)
  
  // Step calcoli fisici
  if (sinceLastPhysicsCalc > phisicsCalcStep){

    // Apply maneuvers
    maneuvers.forEach(({time, deltaV, id}, i) => {
      if (new Date() >= time){
        ship.velocity = ship.velocity.add(deltaV)
        maneuvers.splice(i, 1)
        console.log('Applied deltaV', deltaV)

        let maneuverDiv = document.getElementById(id)
        maneuverDiv.classList.remove('maneuverToDo')
        maneuverDiv.classList.add('maneuverDone')

      }
    })

    let calcOrbit = orbitalCalcBody(ship, earth)
    let v_0 = calcOrbit.v_0
    let r_0 = calcOrbit.r_0
    let angle_0 = calcOrbit.angle_0
    let specificEnergy = calcOrbit.specificEnergy
    let eccentricity = calcOrbit.eccentricity
    let semiMajorAxis = calcOrbit.semiMajorAxis
    let rApoapsis = calcOrbit.rApoapsis
    let rPeriapsis = calcOrbit.rPeriapsis
    let period = calcOrbit.period
    let inclination = calcOrbit.inclination
    let argPeriapsis = calcOrbit.argPeriapsis
    let longAscNode = calcOrbit.longAscNode
    let vApoapsis = calcOrbit.vApoapsis
    let vPeriapsis = calcOrbit.vPeriapsis
    let eccVector = calcOrbit.eccVector  

    document.getElementById('specificEnergyDiv').innerHTML = `Spec. Energy: ${(specificEnergy/1000).toLocaleString(undefined, {maximumFractionDigits:2})} KJ/Kg`
    document.getElementById('semimajAxisDiv').innerHTML = `Sma: ${(semiMajorAxis/1000).toLocaleString(undefined, {maximumFractionDigits:0})} km`
    document.getElementById('eccDiv').innerHTML = `Ecc: ${(eccentricity).toFixed(4)}`
    document.getElementById('eccDiv').innerHTML = `Ecc: ${(eccentricity).toFixed(4)}`
    document.getElementById('apoDiv').innerHTML = `ApD: ${((rApoapsis - earth.radius)/1000).toLocaleString(undefined, {maximumFractionDigits:0})} km`
    document.getElementById('perDiv').innerHTML = `PeD: ${((rPeriapsis - earth.radius)/1000).toLocaleString(undefined, {maximumFractionDigits:0})} km`
    document.getElementById('periodoDiv').innerHTML = `T: ${(period/3600).toLocaleString(undefined, {maximumFractionDigits:2})} h`
    document.getElementById('incl').innerHTML = `Incl: ${(inclination * 180 / Math.PI).toLocaleString(undefined, {maximumFractionDigits:2})} deg.`
    document.getElementById('longAsc').innerHTML = `LonAsc: ${(longAscNode * 180 / Math.PI).toLocaleString(undefined, {maximumFractionDigits:2})} deg.`
    document.getElementById('argPer').innerHTML = `Arg.per: ${(argPeriapsis * 180 / Math.PI).toLocaleString(undefined, {maximumFractionDigits:2})} deg.`
    document.getElementById('vApo').innerHTML = `ApV: ${(vApoapsis).toLocaleString(undefined, {maximumFractionDigits:0})} m/s`
    document.getElementById('vPer').innerHTML = `PeV: ${(vPeriapsis).toLocaleString(undefined, {maximumFractionDigits:0})} m/s`
    document.getElementById('vCur').innerHTML = `v: ${(ship.velocity.module()).toLocaleString(undefined, {maximumFractionDigits:0})} m/s`
    document.getElementById('rCur').innerHTML = `r: ${((ship.position.diff(earth.position).module())/1000).toLocaleString(undefined, {maximumFractionDigits:0})} km`
    document.getElementById('dCur').innerHTML = `h: ${((ship.position.diff(earth.position).module()-earth.radius)/1000).toLocaleString(undefined, {maximumFractionDigits:0})} km`
    document.getElementById('thetaCur').innerHTML = `theta: ${(angle_0*180/Math.PI).toLocaleString(undefined, {maximumFractionDigits:1})} deg.`
    
    // Simulate orbit from parameters
    for (let angleStep = 0; angleStep < angleSteps; angleStep++){

      let theta = (angleStep * 360 / angleSteps) * Math.PI / 180;
      
      // Ellisse
      let r_theta = Math.pow(v_0 * r_0 * Math.sin(angle_0), 2) / (G * earth.mass * (1 + eccentricity * Math.cos(theta)))
      let x = r_theta * Math.cos(theta) * scaleFactor;
      let y = 0;
      let z = r_theta * Math.sin(theta) * scaleFactor;

      let posArray = orbitSim.geometry.getAttribute('position').array;
      posArray[angleStep*3] = x;
      posArray[angleStep*3+1] = y;
      posArray[angleStep*3+2] = z;
      
    }

    orbitSim.geometry.setDrawRange(0, angleSteps)
    orbitSim.geometry.attributes.position.needsUpdate = true;		
    orbitSim.visible = true;	
    orbitSim.computeLineDistances(); 

    // Rotazione su parametri orbitali

    // Reset rotation
    orbitSim.rotation.x = 0
    orbitSim.rotation.y = 0
    orbitSim.rotation.z = 0

    // Apply longitude of ascending node
    orbitSim.rotateOnAxis(new THREE.Vector3(0,1,0).normalize(), -longAscNode)

    // Apply argument of periapsis
    let eccVectorPerp = ship.position.diff(earth.position).cross(ship.velocity).norm()
    orbitSim.rotateOnWorldAxis(eccVectorPerp.toTHREEVector3(), argPeriapsis)

    // Apply inclination
    orbitSim.rotateOnWorldAxis(eccVector.norm().toTHREEVector3(), inclination)	
        
    // Rotate earth
    earth.mesh.rotation.y += 2 * Math.PI / (24*60*60*1000) * sinceLastPhysicsCalc;
    
    // Propagate ship status
    let simSpeed = 1
    let shipRes = propagate(ship.position, ship.velocity, [earth], sinceLastPhysicsCalc / 1000 * simSpeed)
    ship.position = shipRes[0]
    ship.velocity = shipRes[1]
    setMeshPosition(ship);
    
    // Resetta tempo calcolo fisica
    sinceLastPhysicsCalc = 0;

    // Prepare array of future maneuvers to simulate
    let simManeuvers = maneuvers.slice()

    // Refresh orbit propagation
    let shipSim = ship.clone();
	  let shipSimTime = new Date().getTime()    
    for (let step = 0; step < simStepNumber; step++){
      
      let posArray = shipLineMesh.geometry.getAttribute('position').array;	
      posArray[step*3] = shipSim.position.x*scaleFactor;
      posArray[step*3+1] = shipSim.position.y*scaleFactor;
      posArray[step*3+2] = shipSim.position.z*scaleFactor;

      let shipRes = propagate(shipSim.position, shipSim.velocity, [earth], simStepSize)
	    shipSimTime += simStepSize*1000
      
      shipSim.position = shipRes[0]
      shipSim.velocity = shipRes[1]  
      
      // Apply maneuvers
      simManeuvers.forEach(({time, deltaV}, i) => {
        if (shipSimTime >= time){
          shipSim.velocity = shipSim.velocity.add(deltaV)
          simManeuvers.splice(i, 1)
        }
      })      
      
    }
    shipLineMesh.geometry.setDrawRange(0, simStepNumber)
    shipLineMesh.geometry.attributes.position.needsUpdate = true;		
    shipLineMesh.visible = true;	
    
  }
  
  resizeRendererToDisplaySizeIfNeeded(renderer, camera);
  renderer.render(scene, camera);
  stats.update()
  requestAnimationFrame(render);
  
};

render(); // Prima chiamata