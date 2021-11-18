import * as THREE from '../build/three.module.js'
import {scaleFactor} from './constants.js'

export function orbitDraw(calcOrbit, orbitSim, angleSteps){

  let eccentricity = calcOrbit.eccentricity
  let semiMajorAxis = calcOrbit.semiMajorAxis
  let inclination = calcOrbit.inclination
  let argPeriapsis = calcOrbit.argPeriapsis
  let longAscNode = calcOrbit.longAscNode
  let eccVector = calcOrbit.eccVector 

  // Simulate orbit from parameters
  for (let angleStep = 0; angleStep < angleSteps; angleStep++){

    let theta = (angleStep * 360 / angleSteps) * Math.PI / 180;
    
    // Ellisse
    let r_theta = semiMajorAxis * (1 - Math.pow(eccentricity,2)) / (1 + eccentricity * Math.cos(theta))
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
  let eccVectorPerp = calcOrbit.orbitingBody.position.diff(calcOrbit.centreBody.position).cross(calcOrbit.orbitingBody.velocity).norm()
  orbitSim.rotateOnWorldAxis(eccVectorPerp.toTHREEVector3(), argPeriapsis)

  // Apply inclination
  orbitSim.rotateOnWorldAxis(eccVector.norm().toTHREEVector3(), inclination)	

}