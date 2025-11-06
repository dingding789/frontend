import * as THREE from 'three';
import { SketchItem } from './SketchItem';

type ArcMode = 'threePoints' | 'centerStartEnd';

export class ArcItem extends SketchItem {
  private center?: THREE.Vector3;
  private radius?: number;
  private startAngle?: number;
  private endAngle?: number;
  private mode: ArcMode = 'threePoints';

  constructor(public points: THREE.Vector3[] = [], mode: ArcMode = 'threePoints') {
    super('arc');
    this.mode = mode;
  }

  // 约定：
  // - threePoints：this.points[0]=P1，this.points[1]=P2，this.points[2]=P3(可选，预览时用光标)
  // - centerStartEnd：this.points[0]=Center，this.points[1]=Start，this.points[2]=End(可选，预览时用光标)

  // === 工具函数：由三点确定平面正交基 ===
  private static makePlaneBasisFromPoints(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) {
    const v12 = new THREE.Vector3().subVectors(p2, p1);
    const v13 = new THREE.Vector3().subVectors(p3, p1);

    let planeNormal = new THREE.Vector3().crossVectors(v12, v13);
    const nLen = planeNormal.length();
    if (nLen < 1e-12) {
      planeNormal.set(0, 0, 1);
    } else {
      planeNormal.divideScalar(nLen);
    }

    // basisU: v12 去除法向分量后归一
    const basisU = v12.clone().sub(planeNormal.clone().multiplyScalar(v12.dot(planeNormal)));
    if (basisU.lengthSq() < 1e-12) basisU.set(1, 0, 0); else basisU.normalize();

    // basisV = n × u
    const basisV = new THREE.Vector3().crossVectors(planeNormal, basisU).normalize();
    return { planeNormal, basisU, basisV };
  }

  // === 工具函数：由 Center、Start、End 确定平面正交基（中心圆弧） ===
  private static makePlaneBasisFromCenterAndTwoPoints(center: THREE.Vector3, start: THREE.Vector3, end: THREE.Vector3) {
    const cs = new THREE.Vector3().subVectors(start, center);
    const ce = new THREE.Vector3().subVectors(end, center);
    let planeNormal = new THREE.Vector3().crossVectors(cs, ce);
    const nLen = planeNormal.length();
    if (nLen < 1e-12) {
      planeNormal.set(0, 0, 1);
    } else {
      planeNormal.divideScalar(nLen);
    }

    // U 使用 center->start 的方向在平面内的投影
    const basisU = cs.clone().sub(planeNormal.clone().multiplyScalar(cs.dot(planeNormal))).normalize();
    const basisV = new THREE.Vector3().crossVectors(planeNormal, basisU).normalize();
    return { planeNormal, basisU, basisV };
  }

  // 将3D点映射到以 origin 为原点，(basisU,basisV) 为轴的 2D 坐标
  private static to2D(point: THREE.Vector3, origin: THREE.Vector3, basisU: THREE.Vector3, basisV: THREE.Vector3) {
    const vec = new THREE.Vector3().subVectors(point, origin);
    return new THREE.Vector2(vec.dot(basisU), vec.dot(basisV));
  }

  // 三点定圆（使用三点决定的平面）
  private static circleFromThreePointsOnPlane(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) {
    const { planeNormal, basisU, basisV } = ArcItem.makePlaneBasisFromPoints(p1, p2, p3);
    const A = ArcItem.to2D(p1, p1, basisU, basisV);
    const B = ArcItem.to2D(p2, p1, basisU, basisV);
    const C = ArcItem.to2D(p3, p1, basisU, basisV);

    const x1 = A.x, y1 = A.y;
    const x2 = B.x, y2 = B.y;
    const x3 = C.x, y3 = C.y;

    const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    if (Math.abs(d) < 1e-12) return null; // 共线

    const x1s = x1 * x1 + y1 * y1;
    const x2s = x2 * x2 + y2 * y2;
    const x3s = x3 * x3 + y3 * y3;

    const ux = (x1s * (y2 - y3) + x2s * (y3 - y1) + x3s * (y1 - y2)) / d;
    const uy = (x1s * (x3 - x2) + x2s * (x1 - x3) + x3s * (x2 - x1)) / d;

    const center = p1.clone().add(basisU.clone().multiplyScalar(ux)).add(basisV.clone().multiplyScalar(uy));
    const radius = center.distanceTo(p1);

    return { center, radius, planeNormal, basisU, basisV };
  }

  // === 圆参数：由 Center 和 Start/End 确定（中心圆弧） ===
  private static circleFromCenterStartEnd(center: THREE.Vector3, start: THREE.Vector3, end: THREE.Vector3) {
    const { planeNormal, basisU, basisV } = ArcItem.makePlaneBasisFromCenterAndTwoPoints(center, start, end);
    const radius = center.distanceTo(start);
    if (radius < 1e-12) return null;
    return { center, radius, planeNormal, basisU, basisV };
  }

  // 计算某点相对 (center, basisU, basisV) 的极角
  private static angleOnUV(center: THREE.Vector3, point: THREE.Vector3, basisU: THREE.Vector3, basisV: THREE.Vector3) {
    const vec = new THREE.Vector3().subVectors(point, center);
    return Math.atan2(vec.dot(basisV), vec.dot(basisU));
  }

  private static normAngle(a: number) {
    const twoPI = Math.PI * 2;
    a = a % twoPI;
    return a < 0 ? a + twoPI : a;
  }

  // 判断 angleTest 是否在从 angleStart 逆时针到 angleEnd 的区间内（含端点）
  private static isAngleBetweenCounterClockwise(angleStart: number, angleEnd: number, angleTest: number) {
    const s = ArcItem.normAngle(angleStart);
    let e = ArcItem.normAngle(angleEnd);
    const t = ArcItem.normAngle(angleTest);
    if (e < s) e += Math.PI * 2;
    let tt = t;
    if (tt < s) tt += Math.PI * 2;
    return tt >= s - 1e-12 && tt <= e + 1e-12;
  }

  // 只取“端点为 point1、point2，且经过 point3”的那一段弧
  private buildArcPointsBetween(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, steps = 64): THREE.Vector3[] | null {
    const circle = ArcItem.circleFromThreePointsOnPlane(p1, p2, p3);
    if (!circle) return null;
    const { center, radius, basisU, basisV } = circle;

    this.center = center.clone();
    this.radius = radius;

    const a1 = ArcItem.angleOnUV(center, p1, basisU, basisV);
    const a2 = ArcItem.angleOnUV(center, p2, basisU, basisV);
    const a3 = ArcItem.angleOnUV(center, p3, basisU, basisV);

    // 选择包含 p3 的 CCW 弧段
    let start = a1, end = a2;
    if (!ArcItem.isAngleBetweenCounterClockwise(start, end, a3)) {
      start = a2; end = a1;
      if (!ArcItem.isAngleBetweenCounterClockwise(start, end, a3)) return null;
    }

    let s = ArcItem.normAngle(start);
    let e = ArcItem.normAngle(end);
    if (e < s) e += Math.PI * 2;

    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = s + (e - s) * t;
      const x = Math.cos(ang) * radius;
      const y = Math.sin(ang) * radius;
      pts.push(center.clone().add(basisU.clone().multiplyScalar(x)).add(basisV.clone().multiplyScalar(y)));
    }

    this.startAngle = s;
    this.endAngle = e;
    return pts;
  }

  // === 中心圆弧：Center-Start-End，按平面法向的 CCW 从 Start 到 End ===
  private buildArcPointsCenterStartEnd(center: THREE.Vector3, start: THREE.Vector3, end: THREE.Vector3, steps = 64): THREE.Vector3[] | null {
    const circle = ArcItem.circleFromCenterStartEnd(center, start, end);
    if (!circle) return null;
    const { center: c, radius: r, basisU, basisV } = circle;

    this.center = c.clone();
    this.radius = r;

    // 以 Center->Start 的方向为 0 角
    const aStart = 0;
    let aEnd = ArcItem.angleOnUV(c, end, basisU, basisV);
    aEnd = ArcItem.normAngle(aEnd); // CCW 正角度

    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = aStart + aEnd * t;
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      pts.push(c.clone().add(basisU.clone().multiplyScalar(x)).add(basisV.clone().multiplyScalar(y)));
    }

    this.startAngle = aStart;
    this.endAngle = aEnd;
    return pts;
  }

  // 最终绘制（固定端点 P1/P2，P3 决定弧；或 Center/Start/End）
  draw(scene: THREE.Scene) {
    this.remove(scene);
    if (!this.points || this.points.length < 3) return;

    let pts: THREE.Vector3[] | null = null;
    if (this.mode === 'centerStartEnd') {
      const [c, s, e] = this.points as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
      pts = this.buildArcPointsCenterStartEnd(c, s, e);
    } else {
      const [p1, p2, p3] = this.points as [THREE.Vector3, THREE.Vector3, THREE.Vector3];
      pts = this.buildArcPointsBetween(p1, p2, p3);
    }

    if (!pts || !this.radius || this.radius <= 0) return;

    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffff });
    const line = new THREE.Line(geom, mat);
    line.userData.isSketchItem = true;
    this.object3D = line;
    scene.add(line);
  }

  // 预览：
  // - threePoints：锁定 P1/P2，鼠标为 P3
  // - centerStartEnd：锁定 Center/Start，鼠标为 End
  drawPreview(scene: THREE.Scene, cursorPos?: THREE.Vector3) {
    this.remove(scene);
    if (!cursorPos || !this.points) return;

    let pts: THREE.Vector3[] | null = null;
    if (this.mode === 'centerStartEnd') {
      if (this.points.length < 2) return;
      const center = this.points[0];
      const start = this.points[1];
      pts = this.buildArcPointsCenterStartEnd(center, start, cursorPos);
    } else {
      if (this.points.length < 2) return;
      const p1 = this.points[0];
      const p2 = this.points[1];
      pts = this.buildArcPointsBetween(p1, p2, cursorPos);
    }
    if (!pts) return;

    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({ color: 0x00ccff, dashSize: 1, gapSize: 0.5 });
    const line = new THREE.Line(geom, mat);
    line.computeLineDistances();
    line.userData.isSketchItem = true;
    this.object3D = line;
    scene.add(line);
  }

  toJSON() {
    return {
      type: 'arc',
      mode: this.mode,
      point1: this.points[0] ? this.points[0].toArray() : null,
      point2: this.points[1] ? this.points[1].toArray() : null,
      point3: this.points[2] ? this.points[2].toArray() : null,
      center: this.center ? this.center.toArray() : null,
      radius: this.radius ?? 0,
      startAngle: this.startAngle ?? null,
      endAngle: this.endAngle ?? null,
      arcLength:
        this.radius && this.startAngle !== undefined && this.endAngle !== undefined
          ? Math.abs(this.endAngle - this.startAngle) * this.radius
          : 0
    };
  }

  static fromJSON(data: any): ArcItem {
    const arr3 = (v: any) => Array.isArray(v) && v.length === 3;
    const mode: ArcMode = data.mode === 'centerStartEnd' ? 'centerStartEnd' : 'threePoints';

    // 兼容 point1/2/3 或旧的 points 数组
    const p1Arr = arr3(data.point1) ? data.point1 : (Array.isArray(data.points) && arr3(data.points[0]) ? data.points[0] : null);
    const p2Arr = arr3(data.point2) ? data.point2 : (Array.isArray(data.points) && arr3(data.points[1]) ? data.points[1] : null);
    const p3Arr = arr3(data.point3) ? data.point3 : (Array.isArray(data.points) && arr3(data.points[2]) ? data.points[2] : null);

    const pts: THREE.Vector3[] = [];
    if (p1Arr) pts.push(new THREE.Vector3(...p1Arr));
    if (p2Arr) pts.push(new THREE.Vector3(...p2Arr));
    if (p3Arr) pts.push(new THREE.Vector3(...p3Arr));

    const arcItem = new ArcItem(pts, mode);

    if (arr3(data.center)) arcItem.center = new THREE.Vector3(...data.center);
    if (typeof data.radius === 'number') arcItem.radius = data.radius;
    if (typeof data.startAngle === 'number') arcItem.startAngle = data.startAngle;
    if (typeof data.endAngle === 'number') arcItem.endAngle = data.endAngle;

    // 若缺圆参但三点齐全，根据模式补算一次
    if ((!arcItem.center || !arcItem.radius) && pts.length >= 3) {
      if (mode === 'centerStartEnd') {
        arcItem.buildArcPointsCenterStartEnd(pts[0], pts[1], pts[2], 8);
      } else {
        arcItem.buildArcPointsBetween(pts[0], pts[1], pts[2], 8);
      }
    }
    return arcItem;
  }

  // 设置模式
  setMode(mode: ArcMode) {
    this.mode = mode;
  }

  // 获取圆心
  getCenter(): THREE.Vector3 | undefined { return this.center; }

  // 获取半径
  getRadius(): number | undefined { return this.radius; }

  // 获取角度范围
  getAngleRange(): { start: number; end: number } | undefined {
    if (this.startAngle === undefined || this.endAngle === undefined) return undefined;
    return { start: this.startAngle, end: this.endAngle };
  }

  /**
   * 
   * 
   * 
   * 
   * 
   * ircleTool 对应）
   * - app: 应用实例（用于 scene 等）
   * - manager: sketch 管理器，需包含 previewItem、sketchItems 等（sketchItems 为 Ref<Array>）
   * - intersect: 当前拾取点（THREE.Vector3）
   * - mode: 'threePoints' | 'centerStartEnd'
   * - plane: 可选拾取平面（目前仅用于兼容接口）
   */
  static handleArcTool(app: any, manager: any, intersect: THREE.Vector3, mode: ArcMode, plane?: THREE.Plane) {
    const pt = intersect.clone();
    // 三点弧：P1 -> P2 -> P3
    if (mode === 'threePoints') {
      if (!manager.previewItem || !(manager.previewItem instanceof ArcItem)) {
        manager.previewItem = new ArcItem([pt], 'threePoints');
      } else {
        const a = manager.previewItem as ArcItem;
        a.setMode('threePoints');
        if (!a.points) a.points = [];
        if (a.points.length === 0) {
          a.points.push(pt);
        } else if (a.points.length === 1) {
          a.points.push(pt);
        } else if (a.points.length === 2) {
          a.points.push(pt);
          // finalize
          a.remove(app.scene);
          a.draw(app.scene);
          if (manager.sketchItems && Array.isArray(manager.sketchItems.value)) {
            manager.sketchItems.value.push(a);
          }
          manager.previewItem = null;
        }
      }
    } else {
      // 中心弧：Center -> Start -> End
      if (!manager.previewItem || !(manager.previewItem instanceof ArcItem)) {
        manager.previewItem = new ArcItem([pt], 'centerStartEnd');
      } else {
        const a = manager.previewItem as ArcItem;
        a.setMode('centerStartEnd');
        if (!a.points) a.points = [];
        if (a.points.length === 0) {
          a.points.push(pt); // Center
        } else if (a.points.length === 1) {
          a.points.push(pt); // Start（定义半径方向）
        } else if (a.points.length === 2) {
          a.points.push(pt); // End
          // finalize
          a.remove(app.scene);
          a.draw(app.scene);
          if (manager.sketchItems && Array.isArray(manager.sketchItems.value)) {
            manager.sketchItems.value.push(a);
          }
          manager.previewItem = null;
        }
      }
    }
  }
}