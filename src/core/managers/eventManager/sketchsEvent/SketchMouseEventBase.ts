import { MouseEventBase } from '../MouseEventBase';
import * as THREE from 'three';
/**
 * 草图事件基类
 * 提供常用的交互工具函数，比如射线计算、平面交点等
 */
export abstract class SketchMouseEventBase extends MouseEventBase {
  protected getNormalizedMouse(e: MouseEvent): { x: number; y: number } {
    const rect = this.app.renderer.domElement.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
    };
  }

  protected getIntersectOnPlane(mouse: { x: number; y: number }, plane: THREE.Plane): THREE.Vector3 | null {
    const intersect = new THREE.Vector3();
    this.session.raycaster.setFromCamera(mouse, this.app.camera);
    return this.session.raycaster.ray.intersectPlane(plane, intersect) ? intersect : null;
  }
}
