import {G} from './constants.js'
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