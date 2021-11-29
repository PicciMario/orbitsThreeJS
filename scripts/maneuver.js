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

/**
 * Add maneuver to UI.
 * @param {Maneuver} maneuver 
 */
export function addManeuverToUI(maneuver){

	let {time, id, prograde, radial, normal} = maneuver
  
	let newDiv = document.getElementById('maneuver-prototype')
	newDiv = newDiv.cloneNode(true)
	newDiv.id = id
	newDiv.classList.remove('hidden')
	newDiv.classList.add('maneuverToDo')
  
	let label = newDiv.getElementsByClassName("maneuver-label")[0]
	label.innerHTML = new Date(time).toLocaleString() 
  
	let labelPro = newDiv.getElementsByClassName("maneuver-prograde")[0]
	labelPro.innerHTML = prograde
  
	let labelRad = newDiv.getElementsByClassName("maneuver-radial")[0]
	labelRad.innerHTML = radial
  
	let labelNorm = newDiv.getElementsByClassName("maneuver-normal")[0]
	labelNorm.innerHTML = normal
  
	let button = newDiv.getElementsByClassName("maneuver-button")[0]
	button.addEventListener("click", function() {
	  maneuvers = maneuvers.filter(man => man.id !== id)
	  document.getElementById(id).remove()
	})
  
	let buttonAddPro = newDiv.getElementsByClassName("maneuver-add-prograde")[0]
	buttonAddPro.addEventListener("click", function() {
	  maneuvers.filter(man => man.id == id).forEach(man => man.prograde = man.prograde + 100)
	})  
  
	document.getElementById('maneuvers').appendChild(newDiv)  
  
  }
  
  /**
   * Mark maneuver as done in UI.
   * @param {Maneuver} maneuver
   */
  export function markManeuverUIAsDone(maneuver){

	let {id} = maneuver
  
	let maneuverDiv = document.getElementById(id)
	if (maneuverDiv){
	  maneuverDiv.classList.remove('maneuverToDo')
	  maneuverDiv.classList.add('maneuverDone')
	}
  
  }