import * as THREE from 'three';

export class SceneCamera {
  public instance: THREE.PerspectiveCamera;
  constructor(width: number, height: number) {
    this.instance = new THREE.PerspectiveCamera(
      75,
      width / height,
      0.1,
      5000
    );
    this.instance.position.set(200, 200, 200);
    this.instance.lookAt(0, 0, 0);
  }
}
