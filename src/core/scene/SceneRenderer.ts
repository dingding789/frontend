import * as THREE from 'three';

export class SceneRenderer {
  public instance: THREE.WebGLRenderer;
  constructor(enableShadows: boolean) {
    this.instance = new THREE.WebGLRenderer({ antialias: true });
    this.instance.setSize(window.innerWidth, window.innerHeight);
    this.instance.setPixelRatio(window.devicePixelRatio);
    this.instance.shadowMap.enabled = enableShadows;
    this.instance.shadowMap.type = THREE.PCFSoftShadowMap;
  }
}
