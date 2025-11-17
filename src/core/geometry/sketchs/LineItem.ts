/**
 * LineItem
 * 表示草图中的线段元素，支持正式绘制和预览绘制
 * 包含序列化、反序列化、交互工具静态方法
 */

// LineItem.ts
import * as THREE from 'three';
import { SketchItem } from './SketchItem';

// 定义LineItem类，继承自SketchItem，用于表示和绘制线段
export class LineItem extends SketchItem {

  // 构造函数，接受两个THREE.Vector3类型的参数：start和end（end可以为null）
  constructor(public start: THREE.Vector3, public end: THREE.Vector3 | null = null) {
    super("line");
  }

  // 绘制线段的方法
  draw(scene: THREE.Scene) {
    // 如果end为空，则不绘制线段
    if (!this.end) return;

    // 创建BufferGeometry，并根据start和end设置线段的起点和终点
    const geom = new THREE.BufferGeometry().setFromPoints([this.start, this.end]);
    // 创建材质，颜色为青色（0x00ffff）
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffff });
    // 创建线段对象（Line），几何体和材质分别为上述创建的几何体和材质
    this.object3D = new THREE.Line(geom, mat);
    this.object3D.userData.isSketchItem = true; // 标记为草图对象
    // 将线段对象添加到场景中
    scene.add(this.object3D);
  }

  // 绘制线段预览的方法
  drawPreview(scene: THREE.Scene, cursorPos?: THREE.Vector3) {
    // 移除之前添加的线段对象
    this.remove(scene);

    // 如果没有传入鼠标位置，则不绘制预览
    if (!cursorPos) return;

    // 创建BufferGeometry，并根据start和cursorPos设置线段的起点和终点
    const geom = new THREE.BufferGeometry().setFromPoints([this.start, cursorPos]);
    // 创建材质，颜色为青色（0x00ffff），使用虚线样式
    const mat = new THREE.LineDashedMaterial({ color: 0x00ffff, dashSize: 1, gapSize: 0.5 });
    // 创建虚线对象（Line），几何体和材质分别为上述创建的几何体和材质
    const line = new THREE.Line(geom, mat);
    // 计算虚线的距离，以便正确显示虚线效果
    line.computeLineDistances();
    // 将线段对象设置为创建的虚线对象
    this.object3D = line;
    // 将线段对象添加到场景中
    scene.add(this.object3D);
  }

  toJSON() {
    return {
      type: 'line',
      start: this.start.toArray(),
      end: this.end?.toArray() ?? null,
    };
  }

  static fromJSON(data: any): LineItem {
    const start = new THREE.Vector3(...data.start);
    const end = data.end ? new THREE.Vector3(...data.end) : null;
    return new LineItem(start, end);
  }

}
