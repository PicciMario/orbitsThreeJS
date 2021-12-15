import {G, scaleFactor} from './constants.js'
import Vector from './vector.js'

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
export function propagate(actualPosition, actualVelocity, attractors, timestep){
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


export function buildTrajectory(currentTime, simStepNumber, simStepSize, scenario){

  // Copie dei bodies per simulazione
  scenario.filter(elem => elem.body != null).forEach(elem => {
    elem.bodySim = elem.body.clone();
    elem.maneuvers = (elem.maneuvers || []).slice().sort((a,b) => a.time < b.time)
    elem.effectiveSteps = simStepNumber
  })

  // let moonMinDist = -1;
  // let moonMinPos = new Vector()
  // let shipMinPos = new Vector()

  for (let step = 0; step < simStepNumber; step++){

    // Solo per elementi da disegnare: disegna il passo di propagazione e 
    // valuta eventuali collisioni.
    scenario
    .filter(elem => elem.draw && elem.effectiveSteps > step)
    .forEach(elem => {

      // Disegna passo di propagazione
      let posArray = elem.body.lineMesh.geometry.getAttribute('position').array;	
      posArray[step*3] = elem.bodySim.position.x*scaleFactor;
      posArray[step*3+1] = elem.bodySim.position.y*scaleFactor;
      posArray[step*3+2] = elem.bodySim.position.z*scaleFactor;
      elem.body.meshTime[step] = currentTime.getTime();

      // Verifica collisioni
      let collision = false
      elem.attractors.forEach(attrID => {

        // Find attractor by id
        let attr = scenario.find(elem => elem.id == attrID).bodySim

        if (elem.bodySim.position.diff(attr.position).module() < attr.radius){
          collision = true;
        }    

      })  
      if (collision) {
        elem.effectiveSteps = step
      }

    })
   
    // Apply maneuvers
    let simTimeIncrement = simStepSize
    scenario
    .filter(elem => elem.effectiveSteps > step && elem.orbiting)
    .forEach(elem => {

      elem.maneuvers.forEach(({time, prograde, radial, normal}, i) => {

        if (currentTime >= time){
  
          let velVector = elem.bodySim.velocity.norm()
          let radVector = elem.bodySim.position.diff(elem.orbiting.position).norm()
          let normVector = velVector.cross(radVector).norm()
  
          elem.bodySim.velocity = elem.bodySim.velocity
            .add(velVector.scale(prograde))
            .add(radVector.scale(radial))
            .add(normVector.scale(normal))
  
          elem.maneuvers.splice(i, 1)
  
        }
  
        // Se una manovra accade tra questo step e il prossimo, modifica il prossimo
        // step in modo tale da coincidere con la manovra (rende precisa la traiettoria 
        // della simulazione a cavallo del momento della manovra stessa).        
        if (elem.maneuvers.length > 0){
          let nextManeuver = elem.maneuvers[0] // Le manovre sono già ordinate cronologicamente
          let secondsToNextManeuver = (nextManeuver.time.getTime() - currentTime.getTime()) / 1000
          if (secondsToNextManeuver > 0 && secondsToNextManeuver < simTimeIncrement) {
            simTimeIncrement = secondsToNextManeuver
          }
        }      
  
      }) 

    })

    // Calcola il timestamp del passo successivo
    currentTime = new Date(currentTime.getTime() + simTimeIncrement*1000)

    // Per tutti gli elementi da propagare: propaga la posizione simulata al prossimo step
    scenario
    .filter(elem => elem.propagate && elem.effectiveSteps > step)
    .forEach(elem => {

      // find attractors by id
      let attractors = elem.attractors.map(id => scenario.find(item => item.id == id).bodySim)

      let res = propagate(elem.bodySim.position, elem.bodySim.velocity, attractors, simTimeIncrement)
      elem.bodySim.position = res[0]
      elem.bodySim.velocity = res[1]       
    })

    // Minimum distances
    scenario
    .filter(elem => elem.calcMinumumDistances)
    .forEach(primary => {

      scenario.filter(secondary => secondary.id !== primary.id).forEach(secondary => {

        if (primary.minimumDistances == null) primary.minimumDistances = {}

        if (primary.minimumDistances[secondary.id] == null) {
          primary.minimumDistances[secondary.id] = {}
          primary.minimumDistances[secondary.id].primaryPosition = null;
          primary.minimumDistances[secondary.id].secondaryPosition = null;
          primary.minimumDistances[secondary.id].distance = -1;
        }

        let distance = primary.bodySim.position.diff(secondary.bodySim.position).module()
        if (
          (primary.minimumDistances[secondary.id].distance == -1 || primary.minimumDistances[secondary.id].distance > distance)
          && secondary.bodySim.isInsideSOI(primary.bodySim.position)
        ){
          primary.minimumDistances[secondary.id].primaryPosition = primary.bodySim.position;
          primary.minimumDistances[secondary.id].secondaryPosition = secondary.bodySim.position;
          primary.minimumDistances[secondary.id].distance = distance;          
        }

      })

    })    
    
  }

  // Per i bodies da disegnare...
  scenario
  .filter(elem => elem.draw)
  .forEach(elem => {

    // Azzera i punti inutilizzati della mesh
    // (altrimenti fanno collisione con il raytracer anche se non renderizzati)    
    let posArray = elem.body.lineMesh.geometry.getAttribute('position').array;	
    for (let step = elem.effectiveSteps; step < simStepNumber; step++){
      posArray[step*3] = null;
      posArray[step*3+1] = null;
      posArray[step*3+2] = null;
    }
  
    // Refresha la mesh
    elem.body.lineMesh.geometry.setDrawRange(0, elem.effectiveSteps)
    elem.body.lineMesh.geometry.attributes.position.needsUpdate = true;		
    elem.body.lineMesh.updateMatrixWorld();
    elem.body.lineMesh.geometry.computeBoundingBox();
    elem.body.lineMesh.geometry.computeBoundingSphere();
    elem.body.lineMesh.visible = true;	

  })


  // return([
  //   moonMinDist > 0 ? moonMinPos : null, 
  //   moonMinDist > 0 ? shipMinPos : null
  // ])
  return([null, null])

}