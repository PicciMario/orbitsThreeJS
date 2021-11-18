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