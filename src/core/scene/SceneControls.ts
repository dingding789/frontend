// SceneControls.ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SceneControls {
  public instance: OrbitControls;
  public needsRender = true;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.instance = new OrbitControls(camera, domElement);
    this.instance.enablePan = true;
    this.instance.enableZoom = true;
    this.instance.target.set(0, 0, 0);
    this.instance.update();
    this.instance.mouseButtons = {
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN
    };
    this.instance.zoomToCursor = true;
    this.instance.minDistance = 10;
    this.instance.maxDistance = 2000;
    this.instance.addEventListener('change', () => {
      this.needsRender = true;
    });
  }

  update() {
    this.instance.update();
  }
}
