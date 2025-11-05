// RectPreviewItem.ts
import * as THREE from 'three';
import { SketchItem } from './SketchItem';
import { LineItem } from './LineItem';

/**
 * 矩形预览与生成：
 * - 第一次点击确定起点（对角点A）
 * - 移动时基于当前光标点（对角点C）绘制虚线矩形轮廓
 * - 第二次点击时生成四条正式的 LineItem，加入草图
 */
export class RectPreviewItem extends SketchItem {
  constructor(public start: THREE.Vector3, public end: THREE.Vector3 | null = null) {
    super("rect");
  }

  /** 根据对角点 A(start)、C(end) 计算矩形四个顶点顺序 A->B->C->D
   * 自动检测常量轴（XY: z 常量；YZ: x 常量；XZ: y 常量）
   */
  static computeCorners(aIn: THREE.Vector3, cIn: THREE.Vector3): [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] {
    const a = aIn.clone();
    const c = cIn.clone();
    const eps = 1e-6;

    // 检测常量轴
    let constAxis: 'x' | 'y' | 'z' = 'z';
    if (Math.abs(a.x - c.x) < eps) constAxis = 'x';
    else if (Math.abs(a.y - c.y) < eps) constAxis = 'y';
    else constAxis = 'z';

    let b: THREE.Vector3, d: THREE.Vector3;
    if (constAxis === 'z') {
      const z = a.z;
      b = new THREE.Vector3(a.x, c.y, z);
      d = new THREE.Vector3(c.x, a.y, z);
    } else if (constAxis === 'x') {
      const x = a.x;
      // 在 YZ 平面内组合 y/z
      b = new THREE.Vector3(x, a.y, c.z);
      d = new THREE.Vector3(x, c.y, a.z);
    } else {
      const y = a.y;
      // 在 XZ 平面内组合 x/z
      b = new THREE.Vector3(a.x, y, c.z);
      d = new THREE.Vector3(c.x, y, a.z);
    }

    return [a, b, c, d];
  }

  draw(scene: THREE.Scene) {
    // 矩形正式绘制阶段：以闭合线环绘制矩形并将 object3D 保存在自身，便于后续序列化
    if (!this.end) return;
    const a = this.start.clone();
    const c = this.end.clone();
    const [A, B, C, D] = RectPreviewItem.computeCorners(a, c);

    // 移除现有预览对象
    this.remove(scene);

    const pts = [A, B, C, D, A];
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffff });
    const line = new THREE.Line(geom, mat);
    this.object3D = line;
    this.object3D.userData.isSketchItem = true;
    scene.add(this.object3D);
  }

  drawPreview(scene: THREE.Scene, cursorPos?: THREE.Vector3) {
    this.remove(scene);
    if (!cursorPos) return;

    // 以 A(start) 和 C(cursor) 生成矩形四个顶点
  const a = this.start.clone();
  const c = cursorPos.clone();
  const [A, B, C, D] = RectPreviewItem.computeCorners(a, c);

  const pts = [A, B, C, D, A];
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({ color: 0x00ffff, dashSize: 1, gapSize: 0.5 });
    const line = new THREE.Line(geom, mat);
    line.computeLineDistances();
    this.object3D = line;
    scene.add(this.object3D);
  }

  toJSON() {
    return {
      type: 'rect',
      start: this.start.toArray(),
      end: this.end?.toArray() ?? null,
    };
  }

  static fromJSON(data: any): RectPreviewItem {
    const start = new THREE.Vector3(...data.start);
    const end = data.end ? new THREE.Vector3(...data.end) : null;
    return new RectPreviewItem(start, end);
  }
}
