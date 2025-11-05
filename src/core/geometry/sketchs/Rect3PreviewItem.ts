// Rect3PreviewItem.ts
import * as THREE from 'three';
import { SketchItem } from './SketchItem';
import { LineItem } from './LineItem';

/**
 * 三点矩形（中心线法）：
 * - 第一点：中心线起点 p1
 * - 第二点：中心线终点 p2（预览中心虚线或矩形边）
 * - 第三点：决定半宽方向与大小 p3
 */
export class Rect3PreviewItem extends SketchItem {
  public p1: THREE.Vector3;
  public p2: THREE.Vector3 | null = null;
  private planeNormal: THREE.Vector3; // 草图平面法向

  constructor(p1: THREE.Vector3, planeNormal: THREE.Vector3) {
    super("rect");
    this.p1 = p1.clone();
    this.planeNormal = planeNormal.clone().normalize();
  }

  /** 基于中心线 (p1,p2) 与第三点 p3 计算矩形四角 A-B-C-D */
  static computeCornersFromCenterline(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    p3: THREE.Vector3,
    planeNormal: THREE.Vector3,
  ): [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] {
    const eps = 1e-6;

    // 先将点投影到由 p1 和 planeNormal 定义的平面上，保证三点共面
    const n = planeNormal.clone().normalize();
    const projectToPlane = (pt: THREE.Vector3) => {
      const v = new THREE.Vector3().subVectors(pt, p1);
      const dist = v.dot(n);
      return pt.clone().sub(n.clone().multiplyScalar(dist));
    };

    const pp1 = projectToPlane(p1);
    const pp2 = projectToPlane(p2);
    const pp3 = projectToPlane(p3);

    const t = new THREE.Vector3().subVectors(pp2, pp1);
    const len = t.length();
    if (len < eps) {
      // 退化为点，返回零矩形
      return [pp1.clone(), pp1.clone(), pp1.clone(), pp1.clone()];
    }
    t.divideScalar(len); // 单位切向

    // 在平面内的法向向量 u：与 t 垂直且位于平面内
    let u = new THREE.Vector3().crossVectors(n, t);
    if (u.lengthSq() < eps) {
      // 如果 n 与 t 共线（极少数情况），选择一个任意但稳定的平面内向量
      // 选取与 n 不共线的世界轴再叉乘得到 u
      const axis = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      u = new THREE.Vector3().crossVectors(n, axis).normalize();
    } else {
      u.normalize();
    }

    // 以中心点为参考，确定半宽（带符号，决定左右侧）
    const mid = new THREE.Vector3().addVectors(pp1, pp2).multiplyScalar(0.5);
    const wv = new THREE.Vector3().subVectors(pp3, mid);
    const halfW = wv.dot(u); // 可为正或负

    const off = u.clone().multiplyScalar(halfW);
    const A = pp1.clone().add(off);
    const B = pp2.clone().add(off);
    const C = pp2.clone().sub(off);
    const D = pp1.clone().sub(off);
    return [A, B, C, D];
  }

  draw(scene: THREE.Scene): void {
    // 三点法的 draw 通常由 Session 决定最终四边绘制；此处不直接绘制
    // 预览对象在 drawPreview 中以虚线或矩形线环呈现
  }

  drawPreview(scene: THREE.Scene, cursorPos?: THREE.Vector3): void {
    // 移除已有预览
    this.remove(scene);
    if (!cursorPos) return;

    if (!this.p2) {
      // 第二步：仅有 p1，鼠标为 p2 预览中心线（虚线）
      const geom = new THREE.BufferGeometry().setFromPoints([this.p1.clone(), cursorPos.clone()]);
      const mat = new THREE.LineDashedMaterial({ color: 0x00ffff, dashSize: 1, gapSize: 0.5 });
      const line = new THREE.Line(geom, mat);
      line.computeLineDistances();
      this.object3D = line;
      scene.add(this.object3D);
      return;
    }

    // 第三步：已有 p2，预览矩形
    const [A, B, C, D] = Rect3PreviewItem.computeCornersFromCenterline(this.p1, this.p2, cursorPos, this.planeNormal);
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
      type: 'rect3-preview',
      p1: this.p1.toArray(),
      p2: this.p2?.toArray() ?? null,
    };
  }
}
