import * as THREE from '../build/three.module.js'

export default class Arrow{

  constructor(text, color, scene){
  
    const loader = new THREE.FontLoader();
    const lineMat = new THREE.LineBasicMaterial( { color: color } );
  
    const linePoints = [];  
    linePoints.push( new THREE.Vector3(0,0,0));
    linePoints.push( new THREE.Vector3(0,0,0));
  
    const lineGeometry = new THREE.BufferGeometry().setFromPoints( linePoints );	
    
    this.lineMesh = new THREE.Line( lineGeometry, lineMat );
  
    scene.add(this.lineMesh)	
  
    loader.load( 'fonts/helvetiker_regular.typeface.json', (font) => {
  
    const xGeo = new THREE.TextGeometry( text, {
      font: font,
      size: .3,
      height: .01,
      curveSegments: 6,
    });
    
    let xMaterial = new THREE.MeshBasicMaterial({ color: color });
    this.xText = new THREE.Mesh(xGeo , xMaterial);
  
    scene.add(this.xText)
  
    })
  
  }
  
  setStart(position){
    let posArray = this.lineMesh.geometry.getAttribute('position').array;
    posArray[0] = position.x;
    posArray[1] = position.y;
    posArray[2] = position.z;
    this.lineMesh.geometry.attributes.position.needsUpdate = true;		
  }
  
  setEnd(position){
  
    let posArray = this.lineMesh.geometry.getAttribute('position').array;
    posArray[3] = position.x;
    posArray[4] = position.y;
    posArray[5] = position.z;
    this.lineMesh.geometry.attributes.position.needsUpdate = true;
    
    this.xText.position.x = position.x
    this.xText.position.y = position.y
    this.xText.position.z = position.z
  
  }  
  
  refresh(camera){
    if (this.xText && camera){
    this.xText.rotation.x = camera.rotation.x;
    this.xText.rotation.y = camera.rotation.y;
    this.xText.rotation.z = camera.rotation.z;
    }    
  }
  
  
  }