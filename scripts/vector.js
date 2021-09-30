export default class Vector{
  
  constructor(x = 0, y = 0, z = 0){
    this.x = x;
    this.y = y;
    this.z = z;
  }
  
  static fromPolar(radius, inclination, argument){
    return new Vector(
      radius * Math.sin(inclination) * Math.cos(argument),
      radius * Math.sin(inclination) * Math.cos(inclination),
      radius * Math.cos(inclination)
      )
  }
    
  /**
   * Sums another vector to this. Returns a new Vector.
   * @param {Vector} other Other vector.
   * @returns {Vector} This.
   */
  add(other){
    return new Vector(
      this.x + other.x,
      this.y + other.y,
      this.z + other.z
    );
  }
      
  /**
   * Returns a new Vector as difference between this and the 
   * other.
   * @param {Vector} other Other vector.
   * @returns {Vector} This.
   */
  diff(other){
    return new Vector(
      this.x - other.x,
      this.y - other.y,
      this.z - other.z
    );
  }
        
  /**
   * Returns the length of this Vector.
   */
  module(){
    return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z);
  }
        
  /**
   * Normalize. Returns a new Vector with the same direction
   * but unitary length.
   */
  norm(){
    const module = this.module();
    return new Vector(
      this.x / module,
      this.y / module,
      this.z / module
    )
  }
          
  /**
   * Returns a scaled version of this Vector.
   * @param {number} value 
   */
  scale(value){
    return new Vector(
      this.x * value,
      this.y * value,
      this.z * value
    )
  }
            
  /**
   * Returns an inverted version of this Vector.
   */
  minus(){
    return new Vector(
      -this.x,
      -this.y,
      -this.z
    )
  }
              
  print(){
    return({
      x: this.x.toExponential(2),
      y: this.y.toExponential(2), 
      z: this.z.toExponential(2),
      module: this.module().toExponential(2)
    })
  }
              
  /**
  * Returns a copy of this Vector.
  */
  clone(){
    return new Vector(
      this.x,
      this.y,
      this.z
    )
  }
    
  dot(other){
    return (this.x*other.x + this.y*other.y + this.z*other.z)
  }
                
}