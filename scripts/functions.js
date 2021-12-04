import * as THREE from '../build/three.module.js'
import {G, scaleFactor} from '../scripts/constants.js'

// ----------------------------------------------------------------------------

/**
* Inizializza la mesh lineare per disegnare la propagazione di una orbita.
* @param {*} scene
* @param {*} simSize Numero di step.
* @param {*} color Colore.
* @param {boolean} dashed 
* @returns 
*/
export function buildLineMesh(simSize, color = 'red', dashed = false){
  
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

// ----------------------------------------------------------------------------

export function resizeRendererToDisplaySizeIfNeeded(renderer, camera) {
  
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

// ----------------------------------------------------------------------------

/**
* Set the position of the mesh.
* @param {Body} body Corpo da posizionare.
*/
export function setMeshPosition(body){

  if (body == null){
    log.console.error('Tentativo di setMeshPosition con body nullo!');
    return;
  }

  if (body == null){
    log.console.error(`Tentativo di setMeshPosition (body ${body.name}) con mesh nullo!`);
    return;
  }

  body.mesh.position.x = body.position.x * scaleFactor;
  body.mesh.position.y = body.position.y * scaleFactor;
  body.mesh.position.z = body.position.z * scaleFactor;

  if (body.speedMesh == null) return;
  
  body.speedMesh.setDirection(
    new THREE.Vector3(
      body.velocity.x,
      body.velocity.y,
      body.velocity.z
    ).normalize()    
  )

  body.speedMesh.position.x = body.position.x * scaleFactor;
  body.speedMesh.position.y = body.position.y * scaleFactor;
  body.speedMesh.position.z = body.position.z * scaleFactor;

}

// ----------------------------------------------------------------------------

export function createAxisLabel(label, font, x, y, z, color){

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

  return xText

}

// ----------------------------------------------------------------------------

export function alignToCamera(item, camera){
  if (item && camera){
    item.rotation.x = camera.rotation.x;
    item.rotation.y = camera.rotation.y;
    item.rotation.z = camera.rotation.z;
  }
}

// ----------------------------------------------------------------------------

// Refresh orbital parameters div
export function refreshOrbitalParamsUI(calcOrbit){

  let orbitalParamsListUI = [
    {div: 'specificEnergyDiv', 	label: 'Spec.energy', 	unit: 'KJ/Kg', 	val: calcOrbit.specificEnergy/1000},
    {div: 'semimajAxisDiv', 	  label: 'Semimaj.axis',  unit: 'km', 	  val: calcOrbit.semiMajorAxis/1000},
    {div: 'eccDiv', 			      label: 'Eccentricity',  unit: '', 		  val: calcOrbit.eccentricity},
    {div: 'apoDiv', 			      label: 'Apo.height',    unit: 'km', 	  val: (calcOrbit.rApoapsis - calcOrbit.centreBody.radius)/1000},
    {div: 'perDiv', 			      label: 'Per.height',    unit: 'km', 	  val: (calcOrbit.rPeriapsis - calcOrbit.centreBody.radius)/1000},
    {div: 'periodoDiv', 	      label: 'Period',	      unit: 'h', 		  val: calcOrbit.period/3600},
    {div: 'incl', 				      label: 'Inclination',   unit: 'deg', 	  val: calcOrbit.inclination * 180 / Math.PI},
    {div: 'longAsc', 			      label: 'Lon.asc.node',  unit: 'deg', 	  val: calcOrbit.longAscNode * 180 / Math.PI},
    {div: 'argPer', 			      label: 'Argument per.', unit: 'deg', 	  val: calcOrbit.argPeriapsis * 180 / Math.PI},
    {div: 'vApo', 				      label: 'Apo.velocity',  unit: 'm/s', 	  val: calcOrbit.vApoapsis},
    {div: 'vPer', 				      label: 'Per.velocity',  unit: 'm/s', 	  val: calcOrbit.vPeriapsis},
    {div: 'vCur', 				      label: 'Velocity',      unit: 'm/s', 	  val: calcOrbit.orbitingBody.velocity.module()},
    {div: 'rCur', 				      label: 'Radius', 	      unit: 'km', 	  val: calcOrbit.orbitingBody.position.diff(calcOrbit.centreBody.position).module() / 1000},
    {div: 'dCur', 				      label: 'Height', 	      unit: 'km', 	  val: (calcOrbit.orbitingBody.position.diff(calcOrbit.centreBody.position).module() - calcOrbit.centreBody.radius) / 1000},
    {div: 'trueAn', 			      label: 'True anom.',  	unit: 'deg.', 	val: calcOrbit.trueAnomaly*180/Math.PI},
  ]

  orbitalParamsListUI.forEach(({div, label, unit, val}) => {
    document
      .getElementById(div)
      .getElementsByClassName('desc')[0].innerHTML = `${label}`
    document
      .getElementById(div)
      .getElementsByClassName('val')[0].innerHTML = `${val.toLocaleString(undefined, {maximumFractionDigits:2, minimumFractionDigits:2})}`      
    document
      .getElementById(div)
      .getElementsByClassName('unit')[0].innerHTML = `${unit}`            
  })

}

export function refreshTimeUI(currentTime, timeSpeed){
  document.getElementById('timeDiv-currTime').innerHTML = currentTime.toLocaleString()
  document.getElementById('timeDiv-timeAcc').innerHTML = `x${timeSpeed}`
}

// ----------------------------------------------------------------------------

// Calcola istante manovra come interpolazione tra i due punti più vicini 
// trovati lungo la traiettoria simulata.
export function calcManeuverTimeFromIntersection(int, meshTime){

  let point = int.point

  let meshPoints = int.object.geometry.getAttribute('position').array
  let meshIndexLeft = int.index
  let meshIndexRight = int.index + 1
  let meshLeftX = meshPoints[3*meshIndexLeft]
  let meshLeftY = meshPoints[3*meshIndexLeft + 1]
  let meshLeftZ = meshPoints[3*meshIndexLeft + 2]
  let meshRightX = meshPoints[3*meshIndexRight]
  let meshRightY = meshPoints[3*meshIndexRight + 1]
  let meshRightZ = meshPoints[3*meshIndexRight + 2]
  let pointX = point.x
  let pointY = point.y
  let pointZ = point.z

  let leftDist = Math.abs(Math.sqrt(
    Math.pow(meshLeftX-pointX, 2)
    + Math.pow(meshLeftY-pointY, 2)
    + Math.pow(meshLeftZ-pointZ, 2)
  ))
  let rightDist = Math.abs(Math.sqrt(
    Math.pow(meshRightX-pointX, 2)
    + Math.pow(meshRightY-pointY, 2)
    + Math.pow(meshRightZ-pointZ, 2)
  ))    
  let totDist = leftDist + rightDist;
  let leftPerc = leftDist / totDist

  let timeLeft = meshTime[int.index]
  let timeRight = meshTime[int.index + 1]
  let timeDelta = Math.abs(timeLeft - timeRight)
  let timeManeuver = timeLeft + leftPerc*timeDelta 
  
  return timeManeuver;

}