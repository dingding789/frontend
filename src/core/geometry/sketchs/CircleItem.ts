import * as THREE from 'three';
import { SketchItem } from './SketchItem';

// 支持两点圆和三点圆
export type CircleMode = 'two-point' | 'three-point';

// 计算与给定法向正交的局部坐标系(u, v)
function makePlaneBasis(normal: THREE.Vector3): { u: THREE.Vector3; v: THREE.Vector3 } {
  const n = normal.clone().normalize();
  const ref = Math.abs(n.z) < 0.99 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(n, ref).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return { u, v };
}

export class CircleItem extends SketchItem {
  public center: THREE.Vector3;
  public radius: number;
  public mode: CircleMode;
  public point1: THREE.Vector3;
  public point2: THREE.Vector3;
  public point3?: THREE.Vector3;
  public planeNormal: THREE.Vector3;
  private u: THREE.Vector3;
  private v: THREE.Vector3;

  constructor(
    mode: CircleMode,
    point1: THREE.Vector3,
    point2: THREE.Vector3,
    point3?: THREE.Vector3,
    planeNormal: THREE.Vector3 = new THREE.Vector3(0, 0, 1)
  ) {
    super("circle");
    this.mode = mode;
    this.point1 = point1;
    this.point2 = point2;
    this.point3 = point3;
    this.planeNormal = planeNormal.clone().normalize();
    const basis = makePlaneBasis(this.planeNormal);
    this.u = basis.u;
    this.v = basis.v;

    if (mode === 'two-point') {
      this.center = point1.clone();
      this.radius = point1.distanceTo(point2);
    } else {
      if (point3) {
        const result = calcCircleBy3PointsOnPlane(point1, point2, point3, this.planeNormal);
        this.center = result.center;
        this.radius = result.radius;
      } else {
        this.center = point1.clone();
        this.radius = 0;
      }
    }
  }

  /** 从后端 JSON 还原（供 SketchFactory 调用） */
  static fromJSON(data: any): CircleItem {
    const mode: CircleMode = (data.mode as CircleMode) ?? 'two-point';
    const n = Array.isArray(data.planeNormal) ? new THREE.Vector3(...data.planeNormal) : new THREE.Vector3(0, 0, 1);

    const hasPoint1 = Array.isArray(data.point1) && data.point1.length === 3;
    const hasPoint2 = Array.isArray(data.point2) && data.point2.length === 3;
    const hasPoint3 = Array.isArray(data.point3) && data.point3.length === 3;
    const hasCenter = Array.isArray(data.center) && data.center.length === 3; // 兼容 center+radius 结构
    const r = typeof data.radius === 'number' ? data.radius : 0;

    // 选取基准点：优先 p1，否则用 center，否则用 (0,0,0)
    const point1 = hasPoint1
      ? new THREE.Vector3(...data.point1)
      : hasCenter
      ? new THREE.Vector3(...data.center)
      : new THREE.Vector3(0, 0, 0);

    // 基向量用于在仅有 center+radius 或缺 p2 时构造 p2
    const basis = makePlaneBasis(n);

    let point2: THREE.Vector3 | undefined = hasPoint2 ? new THREE.Vector3(...data.point2) : undefined;
    let point3: THREE.Vector3 | undefined = hasPoint3 ? new THREE.Vector3(...data.point3) : undefined;

    // 若缺 p2，但有半径，则用 u 方向构造一个点，避免构造器报错
    if (!point2) {
      if (r > 0) {
        point2 = point1.clone().add(basis.u.clone().multiplyScalar(r));
      } else {
        // 没半径也没 p2，则用 p1 占位，后续再根据三点/两点计算
        point2 = point1.clone();
      }
    }

    const circle = new CircleItem(mode, point1, point2, point3, n);

    // 填充 center/radius
    if (r > 0) {
      circle.center = point1.clone();
      circle.radius = r;
    } else if (mode === 'three-point' && point2 && point3) {
      const res = calcCircleBy3PointsOnPlane(point1, point2, point3, n);
      circle.center = res.center;
      circle.radius = res.radius;
    } else if (point1 && point2) {
      circle.center = point1.clone();
      circle.radius = point1.distanceTo(point2);
    } else {
      circle.center = point1.clone();
      circle.radius = 0;
    }

    return circle;
  }

  draw(scene: THREE.Scene) {
    if (!this.center || this.radius <= 0) return;
    const points: THREE.Vector3[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * 2 * Math.PI;
      const offset = this.u.clone().multiplyScalar(this.radius * Math.cos(theta))
        .add(this.v.clone().multiplyScalar(this.radius * Math.sin(theta)));
      points.push(this.center.clone().add(offset));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x00ffff });
    this.object3D = new THREE.LineLoop(geometry, material);
    this.object3D.userData.isSketchItem = true;
    scene.add(this.object3D);
  }

  drawPreview(scene: THREE.Scene, cursorPos?: THREE.Vector3) {
    this.remove(scene);
    if (!cursorPos) return;
    let center: THREE.Vector3, radius: number;
    if (this.mode === 'two-point') {
      center = this.point1;
      radius = this.point1.distanceTo(cursorPos);
    } else if (this.mode === 'three-point') {
      if (!this.point2) return;
      const result = calcCircleBy3PointsOnPlane(this.point1, this.point2, cursorPos, this.planeNormal);
      center = result.center;
      radius = result.radius;
      if (radius === 0) return;
    } else return;

    const points: THREE.Vector3[] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * 2 * Math.PI;
      const offset = this.u.clone().multiplyScalar(radius * Math.cos(theta))
        .add(this.v.clone().multiplyScalar(radius * Math.sin(theta)));
      points.push(center.clone().add(offset));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineDashedMaterial({ color: 0x00ffff, dashSize: 1, gapSize: 0.5 });
    const line = new THREE.LineLoop(geometry, material);
    line.computeLineDistances();
    this.object3D = line;
    scene.add(this.object3D);
  }

  /** 保存到后端 JSON */
  toJSON() {
    return {
      type: 'circle',
      mode: this.mode,
      point1: this.point1.toArray(),
      point2: this.point2?.toArray(),
      point3: this.point3?.toArray(),
      planeNormal: this.planeNormal.toArray(),
      radius: this.radius ?? 0
    };
  }

  static handleCircleTool(app: any, manager: any, intersect: THREE.Vector3, mode: 'two-point' | 'three-point', plane: THREE.Plane) {
    const planeNormal = plane?.normal.clone() ?? new THREE.Vector3(0, 0, 1);
    const { previewItem } = manager;
    if (mode === 'two-point') {
      if (!previewItem || !(previewItem instanceof CircleItem) || previewItem.mode !== 'two-point') {
        manager.previewItem = new CircleItem('two-point', intersect.clone(), intersect.clone(), undefined, planeNormal);
      } else {
        const c = manager.previewItem as CircleItem;
        c.point2 = intersect.clone();
        c.center = c.point1.clone();
        c.radius = c.point1.distanceTo(c.point2);
        c.remove(app.scene);
        c.draw(app.scene);
        manager.sketchItems.value.push(c);
        manager.previewItem = null;
      }
    } else {
      if (!previewItem || !(previewItem instanceof CircleItem) || previewItem.mode !== 'three-point') {
        manager.previewItem = new CircleItem('three-point', intersect.clone(), intersect.clone(), undefined, planeNormal);
      } else {
        const c = manager.previewItem as CircleItem;
        if (!c.point2) c.point2 = intersect.clone();
        else if (!c.point3) {
          c.point3 = intersect.clone();
          const result = calcCircleBy3PointsOnPlane(c.point1, c.point2, c.point3, planeNormal);
          c.center = result.center;
          c.radius = result.radius;
          c.remove(app.scene);
          c.draw(app.scene);
          manager.sketchItems.value.push(c);
          manager.previewItem = null;
        }
      }
    }
  }
}

// 通过三点计算圆心和半径（带平面法向）
export function calcCircleBy3PointsOnPlane(
  point1: THREE.Vector3,
  point2: THREE.Vector3,
  point3: THREE.Vector3,
  planeNormal: THREE.Vector3
): { center: THREE.Vector3; radius: number } {
  const n = planeNormal.clone().normalize();
  const { u, v } = makePlaneBasis(n);
  const to2D = (p: THREE.Vector3) => {
    const d = p.clone().sub(point1);
    return { x: d.dot(u), y: d.dot(v) };
  };
  const A = { x: 0, y: 0 };
  const B = to2D(point2);
  const C = to2D(point3);
  const a = 2 * (B.x - A.x);
  const b = 2 * (B.y - A.y);
  const c = 2 * (C.x - A.x);
  const d = 2 * (C.y - A.y);
  const e = B.x * B.x + B.y * B.y - A.x * A.x - A.y * A.y;
  const f = C.x * C.x + C.y * C.y - A.x * A.x - A.y * A.y;
  const denominator = a * d - b * c;
  if (Math.abs(denominator) < 1e-6) return { center: point1.clone(), radius: 0 };
  const cx2 = (d * e - b * f) / denominator;
  const cy2 = (a * f - c * e) / denominator;
  const center = point1.clone().add(u.clone().multiplyScalar(cx2)).add(v.clone().multiplyScalar(cy2));
  const radius = Math.sqrt(cx2 * cx2 + cy2 * cy2);
  return { center, radius };
}


