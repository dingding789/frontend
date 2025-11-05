// ExtrudeItem.ts
// 拉伸特征相关类型与实现

import { FeatureItem } from './FeatureItem';
import * as THREE from 'three';
import { RectExtrudeItem } from './RectExtrudeItem';
import { CircleExtrudeItem } from './CircleExtrudeItem';

export type ExtrudeItemType = 'rect' | 'circle'; // 拉伸类型：矩形或圆

/**
 * 拉伸特征基类，继承FeatureItem
 * @param type 拉伸类型
 * @param plane 所在平面（XY/XZ/YZ）
 */
export abstract class ExtrudeItem extends FeatureItem {
  constructor(type: ExtrudeItemType, plane: string = 'XY', id?: string, name?: string) {
    super(type, plane, id, name);
  }

  /**
   * 创建拉伸几何体（静态方法，供管理器或工厂调用）
   * @param item ExtrudeItem实例
   * @param params 拉伸参数
   * @param plane 拉伸体所在平面
   * @param material THREE材质
   * @returns THREE.Mesh | null
   */
  static createExtrudeMesh(item: ExtrudeItem, params: any = {}, plane: string = 'XY', material?: THREE.Material): THREE.Mesh | null {
    /**
     * ExtrudeItem静态方法被ExtrudeManager调用，实现拉伸体创建和预览的解耦与复用。
     */
    let shape: THREE.Shape | null = null;
    let start = params?.start ?? 0;
    let end = params?.end ?? 10;
    let depth = end - start;
    if (depth === 0) return null;
    switch (item.type) {
      case 'rect': {
        const rect = item as RectExtrudeItem;
        if (!rect.p1 || !rect.p2) return null;
        const [x1, y1, z1] = rect.p1;
        const [x2, y2, z2] = rect.p2;
        shape = new THREE.Shape();
        shape.moveTo(x1, z1);
        shape.lineTo(x2, z1);
        shape.lineTo(x2, z2);
        shape.lineTo(x1, z2);
        shape.lineTo(x1, z1);
        break;
      }
      case 'circle': {
        const circle = item as CircleExtrudeItem;
        if (!circle.p1) return null;
        const [cx, cy, cz] = circle.p1;
        shape = new THREE.Shape();
        shape.absarc(cx, cz, circle.radius, 0, Math.PI * 2, false);
        break;
      }
      default:
        return null;
    }
    if (!shape) return null;
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: Math.abs(depth),
      bevelEnabled: false,
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    ExtrudeItem.applyPlaneRotation(geometry, plane);
    geometry.translate(0, 0, Math.min(start, end));
    const mesh = new THREE.Mesh(geometry, material ?? new THREE.MeshStandardMaterial({ color: 0x88ccff }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * 平面旋转工具（静态方法）
   */
  static applyPlaneRotation(geometry: THREE.BufferGeometry, plane: string) {
    switch (plane.toUpperCase()) {
      case 'XZ':
        geometry.rotateX(-Math.PI / 2);
        break;
      case 'YZ':
        geometry.rotateY(Math.PI / 2);
        break;
      default:
        break;
    }
  }
}
