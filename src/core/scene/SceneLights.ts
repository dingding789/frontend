import * as THREE from 'three';

export class SceneLights {
  public ambientLight: THREE.AmbientLight;
  public directionalLight: THREE.DirectionalLight;
  constructor(enableShadows: boolean = true) {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.directionalLight.position.set(300, 400, 200);
    this.directionalLight.castShadow = enableShadows;
    this.directionalLight.shadow.mapSize.width = 2048;
    this.directionalLight.shadow.mapSize.height = 2048;
    this.directionalLight.shadow.camera.near = 1;
    this.directionalLight.shadow.camera.far = 2000;
    this.directionalLight.shadow.camera.left = -500;
    this.directionalLight.shadow.camera.right = 500;
    this.directionalLight.shadow.camera.top = 500;
    this.directionalLight.shadow.camera.bottom = -500;
  }
}
