// CircleExtrudeItem.ts
// 圆形拉伸特征类，继承ExtrudeItem
import { ExtrudeItem } from './ExtrudeItem';
import * as THREE from 'three';
import { CircleItem } from '../../geometry/sketchs/CircleItem';
import AppManager from '../../scene/AppManager';

export abstract class CircleExtrudeItem extends ExtrudeItem {
  p1: [number, number, number]; // 圆心
  radius: number;
  constructor(p1: [number, number, number], radius: number, plane: string = 'XY', id?: string, name?: string) {
    super('circle', plane, id, name);
    this.p1 = p1;
    this.radius = radius;
  }

  /**
   * 生成圆形拉伸体（静态方法）
   * @param item CircleItem
   * @param app AppManager实例
   * @param material THREE材质
   * @param height 拉伸高度
   */
  static extrudeCircle(item: CircleItem, app: AppManager, material: THREE.Material, height: number = 20): THREE.Mesh {
    const geometry = new THREE.CylinderGeometry(
      item.radius,
      item.radius,
      height,
      64
    );
    const mesh = new THREE.Mesh(geometry, material);
    const normal = item.planeNormal?.clone().normalize() ?? new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    mesh.quaternion.copy(quaternion);
    mesh.position.copy(item.center.clone().addScaledVector(normal, height / 2));
    app.scene.add(mesh);
    app.renderOnce();
    return mesh;
  }
}
