import Vector from './vector.js'

export default class Body{
  
  constructor(name, mass, radius, SOIRadius){
    
	  // Nome del corpo celeste
    this.name = name;
	  // Massa [Kg]
    this.mass = mass;
	  // Raggio medio [m]
    this.radius = radius;
	  // Raggio sfera influenza [m]
    this.SOIRadius = SOIRadius;
    
	  // Posizione [m, m, m]
    this.position = new Vector();
	  // Velocità [m^2, m^2, m^2]
    this.velocity = new Vector();
    
    this.mesh = null;
	  this.speedMesh = null;
    this.lineMesh = null;

  }
  
  /**
  * Calcola la posizione di un satellite.
  * @param {*} height Altezza sopra la superficie [m]
  * @param {*} inclination Inclinazione [°]
  * @param {*} azimuth Azimuth [°]
  * @returns 
  */
  calcSatellitePosition(height, inclination, azimuth){
    let r = height + this.radius;
    let theta = 2 * Math.PI * inclination / 360;
    let phi = 2 * Math.PI * azimuth / 360;
    let x = r * Math.cos(phi) * Math.sin(theta);
    let y = r * Math.sin(phi) * Math.sin(theta);
    let z = r * Math.cos(theta);
    return this.position.add(new Vector(x, y, z));
  }
  
  clone(){
    
    let newBody = new Body(this.name);
    
    newBody.name = this.name;
    newBody.mass = this.mass;
    newBody.radius = this.radius;
    newBody.SOIRadius = this.SOIRadius;
    
    newBody.position = this.position.clone();
    newBody.velocity = this.velocity.clone();
    
    newBody.mesh = null;
    
    return newBody;

  }
  
}