import Vector from './vector.js'

export default class Body{
  
  constructor(name){
    
    this.name = name;
    this.mass = 0;
    this.radius = 0;
    this.SOIRadius = 0;
    
    this.position = new Vector();
    this.velocity = new Vector();
    
    this.mesh = null;
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