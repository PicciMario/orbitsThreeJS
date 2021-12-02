export default class Maneuver{

	constructor(time, prograde, radial, normal){
		this.id = randomID();
		this.time = time;
		this.prograde = prograde;
		this.radial = radial;
		this.normal = normal;
	}

}

// ----------------------------------------------------------------------------

function randomID(){
	return '_' + Math.random().toString(36).substr(2, 9);
}

