/**
 * PointItem
 * 表示草图中的点元素，支持绘制、预览、序列化等
 * 静态方法 handlePointTool 用于草图交互逻辑
 */

// PointItem.ts
import * as THREE from 'three';
import { SketchItem } from './SketchItem';

// 定义PointItem类，继承自SketchItem，用于表示和绘制点
export class PointItem extends SketchItem {
  // 构造函数，接受一个THREE.Vector3类型的position参数，并将其传递给基类SketchItem
  constructor(public position: THREE.Vector3) {
    super("point");
  }

  // 绘制点的方法
  draw(scene: THREE.Scene) {
    // 创建球体几何体，半径为1，宽度段数为8，高度段数为8
    const geom = new THREE.SphereGeometry(1, 8, 8);
    // 创建材质，颜色为黄色（0xffff00）
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    // 创建网格对象（Mesh），几何体和材质分别为上述创建的几何体和材质
    this.object3D = new THREE.Mesh(geom, mat);
    // 设置网格对象的位置为传入的位置
    this.object3D.position.copy(this.position);
    // 将网格对象添加到场景中
    scene.add(this.object3D);
  }

  // 绘制点的预览方法
  drawPreview(scene: THREE.Scene) {
    // 点不需要动态预览，可以直接显示
    this.draw(scene);
  }
  
   toJSON() {
    return {
      type: 'point',
      position: [this.position.x, this.position.y, this.position.z],
    };
  }

  static fromJSON(data: any): PointItem {
    return new PointItem(new THREE.Vector3(...data.position));
  }

}
