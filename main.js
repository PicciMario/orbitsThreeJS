import * as THREE from './build/three.module.js'
import { OrbitControls } from './examples/jsm/controls/OrbitControls.js'
import Stats from './examples/jsm/libs/stats.module.js'
import { GUI } from './examples/jsm/libs/dat.gui.module.js'
import Body from './scripts/body.js'
import Vector from './scripts/vector.js'
import {orbitalCalcBody} from './scripts/orbit-calc.js'
import {orbitDraw} from './scripts/orbit-draw.js'
import {propagate, buildTrajectory} from './scripts/propagation-calc.js'
import {G, scaleFactor} from './scripts/constants.js'
import {
  buildLineMesh, resizeRendererToDisplaySizeIfNeeded, setMeshPosition, 
  createAxisLabel, alignToCamera, refreshOrbitalParamsUI,
  calcManeuverTimeFromIntersection, refreshTimeUI
} from './scripts/functions.js'
import Maneuver from './scripts/maneuver.js'
import Arrow from './scripts/arrow.js'

// --- Costanti ---------------------------------------------------------------

// Durata step calcoli fisici [ms]
const phisicsCalcStep = 300
// Durata step simulazione propagazione [s]
const simStepSize = 100;
// Numero step simulazione propagazione
const simStepNumber = 10000;

// --- Variabili --------------------------------------------------------------

// Timekeeping simulazione
let currentTime = new Date()
// Simulation step in seconds
let timeStep = .3
// Moltiplicatore velocità simulazione
let timeSpeed = 10

// --- Inizializzazione elementi fissi ----------------------------------------

// Inizializzazione videocamera
var camera = new THREE.PerspectiveCamera(30, 1, 1, 100000);
camera.position.z = 60;
camera.position.y = 0//80;
camera.position.x = 0//-60;
camera.lookAt(0,0,0)

// Inizializzazione canvas
const canvas = document.querySelector('#c');
var renderer = new THREE.WebGLRenderer({canvas, antialias:true});

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

var axis = new THREE.AxesHelper(15);
scene.add(axis);

const loader = new THREE.FontLoader();
var xLabel, yLabel, zLabel
loader.load( 'fonts/helvetiker_regular.typeface.json', function(font){
  xLabel = createAxisLabel('X', font, 15, 0, 0, 'red')
  scene.add(xLabel)
  yLabel = createAxisLabel('Y', font, 0, 15, 0, 'green')
  scene.add(yLabel)
  zLabel = createAxisLabel('Z', font, 0, 0, 15, 'blue')
  scene.add(zLabel)
});
        
// --- Earth ------------------------------------------------------------------

var earth = new Body('Earth', 5.972e24, 6371e3, 0.929e9);

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

// --- Moon -------------------------------------------------------------------

var moon = new Body('Moon', 7.3477e22, 1737.1e3, 0.0661e9);

let moonRadius = 3.844e8
// moon.position = earth.calcSatellitePosition(moonRadius, 90, 0)
let moonAngle = 0 + (65 * Math.PI / 180)
moon.position = new Vector(
  moonRadius * Math.cos(moonAngle),
  0,
  moonRadius * Math.sin(moonAngle),
)

let orbitVelocity = 1027.77	
// moon.velocity = new Vector(0, 0, -orbitVelocity);
moon.velocity = new Vector(
  orbitVelocity * Math.sin(moonAngle),
  0,
  orbitVelocity * -Math.cos(moonAngle)
)

//Create geometry and material
var moonGeometry = new THREE.SphereGeometry(
  moon.radius * scaleFactor, 
  50, 
  50
);
var moonMaterial = new THREE.MeshPhongMaterial({
  color: 0xaaaaaa
});
moon.mesh = new THREE.Mesh(moonGeometry, moonMaterial);

scene.add(moon.mesh);
setMeshPosition(moon);

// Create moon line mesh
moon.lineMesh = buildLineMesh(simStepNumber, 'green') 
scene.add(moon.lineMesh)

// --- Ship -------------------------------------------------------------------

var ship = new Body('Ship', 100000, 200000, 0);

// Create ship mesh
var shipGeometry = new THREE.SphereGeometry(200000 * scaleFactor, 50, 50 );
var shipMaterial = new THREE.MeshPhongMaterial({
  color: 'lightgreen',
  transparent: true,
  opacity: .8
});
ship.mesh = new THREE.Mesh(shipGeometry, shipMaterial);
scene.add(ship.mesh);
setMeshPosition(ship);

// Create ship speed mesh
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
scene.add(ship.speedMesh);

// Create ship line mesh
ship.lineMesh = buildLineMesh(simStepNumber, 'green')
scene.add(ship.lineMesh)

// ----------------------------------------------------------------------------

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
  },
  {
    desc: 'Eq. Circ. Pro.',
    // position: earth.calcSatellitePosition(400e3, 0, 0),
    position: new Vector(-400e3 - earth.radius, 0, 0),
    velocity: new Vector(0, 0, 7670 + 3085)
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
let angleSteps = 36*2*20;
let orbitSim = buildLineMesh(angleSteps, 'yellow', true)
scene.add(orbitSim)

let moonOrbitSim = buildLineMesh(angleSteps, 'yellow', true)
scene.add(moonOrbitSim)

// ----- Creazione manovra ----------------------------------------------------

window.addEventListener('click', onDocumentMouseDown, false);

var raycaster = new THREE.Raycaster();
raycaster.linePrecision = 0.2;

function onDocumentMouseDown( event ) {

  event.preventDefault();

  var mouse = new THREE.Vector2();
  mouse.x = ( event.clientX / renderer.domElement.clientWidth ) * 2 - 1;
  mouse.y = - ( event.clientY / renderer.domElement.clientHeight ) * 2 + 1;

  raycaster.setFromCamera( mouse, camera );

  var intersects = raycaster.intersectObjects([ship.lineMesh]);

  if (intersects.length > 0){

    // Punto di intersezione (quello con l'indice minore in caso di più punti sovrapposti)
    let int = intersects.sort((a,b) => a.index - b.index)[0]

    // Calcola istante manovra come interpolazione tra i due punti più vicini 
    // trovati lungo la traiettoria simulata.
    let timeManeuver = calcManeuverTimeFromIntersection(int, ship.meshTime)

    // Aggiunge manovra alla lista
    let newManeuver = new Maneuver(
      new Date(timeManeuver),
      1000,
      0,
      0
    );
    addManeuver(newManeuver, maneuvers)

    // Punto esatto raycaster (punto manovra)
    let pointGeometry = new THREE.SphereGeometry(100000 * scaleFactor, 50, 50 );
    var pointMaterial = new THREE.MeshPhongMaterial({
      color: 'blue',
      transparent: true,
      opacity: .8
    });    
    let pointMesh = new THREE.Mesh(pointGeometry, pointMaterial)
    let point = int.point
    pointMesh.position.x = point.x
    pointMesh.position.y = point.y
    pointMesh.position.z = point.z
    scene.add(pointMesh) 

  }
}

// -----------------------------------------------------------------

// Lista globale manovre
var maneuvers = []

// Manovre di test
let newManeuvers = [
  // new Maneuver(
  //   new Date(new Date().getTime() + 100 * 1000),
  //   100,
  //   1000,
  //   0
  // ),
  // new Maneuver(
  //   new Date(new Date().getTime() + 100 * 1000),
  //   100,
  //   1000,
  //   0
  // ),
  // new Maneuver(
  //   new Date(new Date().getTime() + 100 * 1000),
  //   100,
  //   1000,
  //   0
  // ),
]
newManeuvers.forEach(man => addManeuver(man))

/**
 * Add maneuver to UI.
 * @param {Maneuver} maneuver
 * @param {Maneuver[]} maneuvers 
 */
 export function addManeuver(maneuver){

	maneuvers.push(maneuver);

	let {time, id, prograde, radial, normal} = maneuver
  
	let newDiv = document.getElementById('maneuver-prototype')
	newDiv = newDiv.cloneNode(true)
	newDiv.id = id
	newDiv.classList.remove('hidden')
	newDiv.classList.add('maneuverToDo')
  
	let label = newDiv.getElementsByClassName("maneuver-label")[0]
	label.innerHTML = new Date(time).toLocaleString() 
  
	let labelPro = newDiv.getElementsByClassName("maneuver-prograde")[0]
	labelPro.innerHTML = prograde
  
	let labelRad = newDiv.getElementsByClassName("maneuver-radial")[0]
	labelRad.innerHTML = radial
  
	let labelNorm = newDiv.getElementsByClassName("maneuver-normal")[0]
	labelNorm.innerHTML = normal
  
	let button = newDiv.getElementsByClassName("maneuver-button")[0]
	button.addEventListener("click", function() {
	  maneuvers = maneuvers.filter(man => man.id !== id)
	  document.getElementById(id).remove()
	})
  
	let buttonAddPro = newDiv.getElementsByClassName("maneuver-add-prograde")[0]
	buttonAddPro.addEventListener("click", function() {
	  maneuvers.filter(man => man.id == id).forEach(man => man.prograde = man.prograde + 100)
	})  
  
	document.getElementById('maneuvers').appendChild(newDiv)  
  
  }
  
  /**
   * Mark maneuver as done in UI.
   * @param {Maneuver} maneuver
   */
  export function markManeuverUIAsDone(maneuver){

	let {id} = maneuver
  
	let maneuverDiv = document.getElementById(id)
	if (maneuverDiv){
	  maneuverDiv.classList.remove('maneuverToDo')
	  maneuverDiv.classList.add('maneuverDone')
	}
  
}

// -----------------------------------------------------------------

// Timekeeping

document.getElementById('timeDiv').getElementsByClassName('timeDiv-incTimeAcc')[0].addEventListener("click", event => {
  timeSpeed = Math.min(timeSpeed * 10, 10000)
})
document.getElementById('timeDiv').getElementsByClassName('timeDiv-decTimeAcc')[0].addEventListener("click", event => {
  timeSpeed = Math.max(1, timeSpeed / 10)
})

// -----------------------------------------------------------------

// Calcola e disegna orbita simulata Luna
let calcOrbitMoon = orbitalCalcBody(moon, earth)
orbitDraw(calcOrbitMoon, moonOrbitSim, angleSteps, scaleFactor)  

// -----------------------------------------------------------------

// Timer principale dei calcoli fisici

setInterval(() => {

  currentTime = new Date(currentTime.getTime() + timeStep * 1000 * timeSpeed)
  refreshTimeUI(currentTime, timeSpeed)

  // Rotate earth
  earth.mesh.rotation.y += 2 * Math.PI / (24*60*60*1000) * 300;  

  // Propagate ship status
  let [shipPosition, shipVelocity] = propagate(ship.position, ship.velocity, [earth], timeStep * timeSpeed)
  ship.position = shipPosition
  ship.velocity = shipVelocity
  setMeshPosition(ship);

  // Propagate moon status
  let [moonPosition, moonVelocity] = propagate(moon.position, moon.velocity, [earth], timeStep * timeSpeed)
  moon.position = moonPosition
  moon.velocity = moonVelocity
  setMeshPosition(moon);	

}, timeStep*1000)

// -----------------------------------------------------------------

// Sfere per indicazione passaggio minimo ship-moon

var moonSimGeo = new THREE.SphereGeometry(2000000 * scaleFactor, 50, 50 );
var moonSimMat = new THREE.MeshPhongMaterial({
  color: 'lightgreen',
  transparent: true,
  opacity: .8
});
let moonSimMesh = new THREE.Mesh(moonSimGeo, moonSimMat);
scene.add(moonSimMesh);

var shipSimGeo = new THREE.SphereGeometry(2000000 * scaleFactor, 50, 50 );
var shipSimMat = new THREE.MeshPhongMaterial({
  color: 'red',
  transparent: true,
  opacity: .8
});
let shipSimMesh = new THREE.Mesh(shipSimGeo, shipSimMat);
scene.add(shipSimMesh); 


// -----------------------------------------------------------------

// Vettori debug
let eccArrow = new Arrow("ecc", "yellow", scene)

// Funzione di rendering

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
  [xLabel, yLabel, zLabel].forEach(label => alignToCamera(label, camera))
  
  // Step calcoli fisici
  if (sinceLastPhysicsCalc > phisicsCalcStep){

    // Apply maneuvers
    maneuvers.forEach((man, i) => {

      let {time, prograde, radial, normal} = man

      if (currentTime >= time){

        let velVector = ship.velocity.norm()
        let radVector = ship.position.diff(earth.position).norm()
        let normVector = velVector.cross(radVector).norm()

        ship.velocity = ship.velocity
          .add(velVector.scale(prograde))
          .add(radVector.scale(radial))
          .add(normVector.scale(normal))

        maneuvers.splice(i, 1)

        markManeuverUIAsDone(man)

      }
    })

    // Calcola e disegna orbita simulata
    let calcOrbit = orbitalCalcBody(ship, earth)
    orbitDraw(calcOrbit, orbitSim, angleSteps, scaleFactor)

    // vettori debug
    eccArrow.setEnd(calcOrbit.eccVector.norm().scale(15))
    eccArrow.refresh(camera)

    // Aggiorna parametri orbita simulata e stato corrente su UI
    refreshOrbitalParamsUI(calcOrbit)

    // Disegna traiettorie propagate
    let [moonMinPos, shipMinPos] = buildTrajectory(currentTime, ship, [earth, moon], simStepNumber, simStepSize, maneuvers, earth, moon)

    if (moonMinPos && shipMinPos){
      moonSimMesh.position.x = moonMinPos.x * scaleFactor;
      moonSimMesh.position.y = moonMinPos.y * scaleFactor;
      moonSimMesh.position.z = moonMinPos.z * scaleFactor;
      shipSimMesh.position.x = shipMinPos.x * scaleFactor;
      shipSimMesh.position.y = shipMinPos.y * scaleFactor;
      shipSimMesh.position.z = shipMinPos.z * scaleFactor;   
    }
    
    // Resetta tempo calcolo fisica
    sinceLastPhysicsCalc = 0;

  }
  
  resizeRendererToDisplaySizeIfNeeded(renderer, camera);
  renderer.render(scene, camera);
  stats.update()
  requestAnimationFrame(render);
  
};

render(); // Prima chiamata