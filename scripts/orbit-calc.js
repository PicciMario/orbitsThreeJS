import Vector from './vector.js'
import {G} from './constants.js'

/**
 * Calculater orbital parameters of orbiting body.
 * @param {Body} orbitingBody 
 * @param {Body} centreBody 
 * @returns 
 */
export function orbitalCalcBody(orbitingBody, centreBody){

  let velocity = orbitingBody.velocity
  let position = orbitingBody.position
  let attractorPosition = centreBody.position

  // Constants
  let M = centreBody.mass

  // Initial state vector
  let relPosition = position.diff(attractorPosition)
  let v_0 = velocity.module()
  let r_0 = relPosition.module()
  let angle_0 = relPosition.angle(velocity)

  // Specific energy (Earth orbit)
  let specificEnergy = Math.pow(v_0, 2) / 2.0 - G * M / r_0

  // Semimajor axis
  let semiMajorAxis = - G * M / (2 * specificEnergy)

  // Orbit eccentricity
  let eccentricity = Math.sqrt(1+(
    (2 * Math.pow(v_0, 2) * Math.pow(r_0, 2) * Math.pow(Math.sin(angle_0), 2) * specificEnergy)
    /(Math.pow(G, 2) * Math.pow(M, 2))
  ))

  // Orbit shape
  let rApoapsis = (semiMajorAxis * (1 + eccentricity))
  let rPeriapsis = (semiMajorAxis * (1 - eccentricity))

  // Orbital period
  let period = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / (G * M))

  // Specific angular moment vector
  let h = relPosition.cross(velocity)
  // Inclination
  let inclination = Math.acos(h.y / h.module())

  // Nodes vector
  let n = new Vector(0, 1, 0).cross(h)
  // Longitude of ascending node
  let longAscNode = Math.acos(n.x / n.module())
  if (n.z < 0) longAscNode = 2*Math.PI - longAscNode  
  //if (isNaN(longAscNode)) longAscNode = 0

  // Eccentricity vector
  let eccVector = velocity
    .cross(h)
    .scale(1/(G*M))
    .diff(relPosition.scale(1/relPosition.module()))
  
  // Argument of periapsis
  let argPeriapsis = Math.acos(n.dot(eccVector)/(n.module() * eccVector.module()))
  if (eccVector.y < 0) argPeriapsis = 2*Math.PI - argPeriapsis
  if (isNaN(argPeriapsis)) argPeriapsis = 0
  if (inclination == 0 || inclination == Math.PI){
    argPeriapsis = Math.acos(eccVector.x / eccVector.module())
    console.log(eccVector.x)
    if (eccVector.z < 0) argPeriapsis = 2*Math.PI - argPeriapsis
  }

  // Velocità
  let vApoapsis = Math.sqrt(G * M * ((2/rApoapsis)-(1/semiMajorAxis)))
  let vPeriapsis = Math.sqrt(G * M * ((2/rPeriapsis)-(1/semiMajorAxis)))

  // True anomaly
  let trueAnomaly = Math.acos(eccVector.dot(relPosition) / (eccVector.module() * relPosition.module()))
  if (relPosition.dot(velocity) < 0){
    trueAnomaly = 2 * Math.PI - trueAnomaly
  }

  let state = {
    
    v_0,
    r_0,
    angle_0,

    specificEnergy,
    eccentricity,
    semiMajorAxis,
    rApoapsis,
    rPeriapsis,
    period,
    inclination,
    argPeriapsis,
    longAscNode,
    vApoapsis,
    vPeriapsis,
    eccVector,
    trueAnomaly,

    orbitingBody, 
    centreBody    

  }

  return state;

}