// ArcItem.ts
// 草图圆弧图元类，支持三点圆弧和圆心-起点-终点两种模式
// 提供圆弧的几何计算、绘制、预览、序列化等功能
// 主要方法：
// - computeCircleThreePoints: 通过三点计算圆心和半径
// - computeCircleCenterStartEnd: 通过圆心、起点、终点计算圆心和半径
// - buildPoints: 构建圆弧上的点集
// - draw/drawPreview: 绘制圆弧和预览
// - handleArcTool: 圆弧工具的交互入口
// - toJSON/fromJSON: 序列化与反序列化
// 适用于草图编辑器中的圆弧绘制与管理

import * as THREE from 'three';
import { SketchItem } from './SketchItem';

type ArcMode = 'threePoints' | 'centerStartEnd';

interface SketchManager {
  previewItem: ArcItem | null;
  sketchItems: { value: ArcItem[] };
}

interface App {
  scene: THREE.Scene;
}

export class ArcItem extends SketchItem {
  private center?: THREE.Vector3;
  private radius?: number;
  private startAngle?: number;
  private endAngle?: number;
  private basisU?: THREE.Vector3;
  private basisV?: THREE.Vector3;

  // 预览时用于显示的中心点标记（仅 centerStartEnd 模式使用）
  private centerMarker?: THREE.Object3D | null;

  constructor(public points: THREE.Vector3[] = [], private mode: ArcMode = 'threePoints') {
    super('arc');
  }

  setMode(mode: ArcMode) { this.mode = mode; }
  getCenter() { return this.center; }
  getRadius() { return this.radius; }
  getAngleRange() { return this.startAngle !== undefined && this.endAngle !== undefined ? { start: this.startAngle, end: this.endAngle } : undefined; }

  // === 工具函数：由三点确定平面正交基 ===
  private static makePlaneBasisFromPoints(point1: THREE.Vector3, point2: THREE.Vector3, point3: THREE.Vector3) {
    const vectorPoint1ToPoint2 = new THREE.Vector3().subVectors(point2, point1);
    const vectorPoint1ToPoint3 = new THREE.Vector3().subVectors(point3, point1);

    let planeNormal = new THREE.Vector3().crossVectors(vectorPoint1ToPoint2, vectorPoint1ToPoint3);
    const normalLength = planeNormal.length();
    if (normalLength < 1e-12) {
      planeNormal.set(0, 0, 1);
    } else {
      planeNormal.divideScalar(normalLength);
    }

    // basisU: vectorPoint1ToPoint2 去除法向分量后归一
    const basisU = vectorPoint1ToPoint2.clone().sub(planeNormal.clone().multiplyScalar(vectorPoint1ToPoint2.dot(planeNormal)));
    if (basisU.lengthSq() < 1e-12) basisU.set(1, 0, 0); else basisU.normalize();

    // basisV = n × u
    const basisV = new THREE.Vector3().crossVectors(planeNormal, basisU).normalize();
    return { planeNormal, basisU, basisV };
  }

  // === 工具函数：由 Center、Start、End 确定平面正交基（中心圆弧） ===
  private static makePlaneBasisFromCenterAndTwoPoints(center: THREE.Vector3, start: THREE.Vector3, end: THREE.Vector3) {
    const centerToStart = new THREE.Vector3().subVectors(start, center);
    const centerToEnd = new THREE.Vector3().subVectors(end, center);
    let planeNormal = new THREE.Vector3().crossVectors(centerToStart, centerToEnd);
    const normalLength = planeNormal.length();
    if (normalLength < 1e-12) {
      planeNormal.set(0, 0, 1);
    } else {
      planeNormal.divideScalar(normalLength);
    }

    // U 使用 center->start 的方向在平面内的投影
    const basisU = centerToStart.clone().sub(planeNormal.clone().multiplyScalar(centerToStart.dot(planeNormal))).normalize();
    const basisV = new THREE.Vector3().crossVectors(planeNormal, basisU).normalize();
    return { planeNormal, basisU, basisV };
  }

  // 将3D点映射到以 origin 为原点，(basisU,basisV) 为轴的 2D 坐标
  private static projectPointTo2D(point: THREE.Vector3, origin: THREE.Vector3, basisU: THREE.Vector3, basisV: THREE.Vector3) {
    const delta = new THREE.Vector3().subVectors(point, origin);
    return new THREE.Vector2(delta.dot(basisU), delta.dot(basisV));
  }

  // 三点定圆（使用三点决定的平面）
  private static circleFromThreePointsOnPlane(point1: THREE.Vector3, point2: THREE.Vector3, point3: THREE.Vector3) {
    const { planeNormal, basisU, basisV } = ArcItem.makePlaneBasisFromPoints(point1, point2, point3);
    const pointA2D = ArcItem.projectPointTo2D(point1, point1, basisU, basisV);
    const pointB2D = ArcItem.projectPointTo2D(point2, point1, basisU, basisV);
    const pointC2D = ArcItem.projectPointTo2D(point3, point1, basisU, basisV);

    const pointAX = pointA2D.x, pointAY = pointA2D.y;
    const pointBX = pointB2D.x, pointBY = pointB2D.y;
    const pointCX = pointC2D.x, pointCY = pointC2D.y;

    const denominator = 2 * (pointAX * (pointBY - pointCY) + pointBX * (pointCY - pointAY) + pointCX * (pointAY - pointBY));
    if (Math.abs(denominator) < 1e-12) return null; // 共线

    const aLenSq = pointAX * pointAX + pointAY * pointAY;
    const bLenSq = pointBX * pointBX + pointBY * pointBY;
    const cLenSq = pointCX * pointCX + pointCY * pointCY;

    const centerLocalU = (aLenSq * (pointBY - pointCY) + bLenSq * (pointCY - pointAY) + cLenSq * (pointAY - pointBY)) / denominator;
    const centerLocalV = (aLenSq * (pointCX - pointBX) + bLenSq * (pointAX - pointCX) + cLenSq * (pointBX - pointAX)) / denominator;

    const center = point1.clone().add(basisU.clone().multiplyScalar(centerLocalU)).add(basisV.clone().multiplyScalar(centerLocalV));
    const radius = center.distanceTo(point1);

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
  private static angleOnBasisUV(center: THREE.Vector3, point: THREE.Vector3, basisU: THREE.Vector3, basisV: THREE.Vector3) {
    const vec = new THREE.Vector3().subVectors(point, center);
    return Math.atan2(vec.dot(basisV), vec.dot(basisU));
  }

  private static normalizeAngle(angle: number) {
    const twoPI = Math.PI * 2;
    angle = angle % twoPI;
    return angle < 0 ? angle + twoPI : angle;
  }

  // 判断 testAngle 是否在从 startAngle 逆时针到 endAngle 的区间内（含端点）
  private static isAngleBetweenCCW(startAngle: number, endAngle: number, testAngle: number) {
    const s = ArcItem.normalizeAngle(startAngle);
    let e = ArcItem.normalizeAngle(endAngle);
    const t = ArcItem.normalizeAngle(testAngle);
    if (e < s) e += Math.PI * 2;
    let tt = t; if (tt < s) tt += Math.PI * 2;
    return tt >= s - 1e-12 && tt <= e + 1e-12;
  }

  // 只取“端点为 point1、point2，且经过 point3”的那一段弧
  private buildArcPointsBetween(point1: THREE.Vector3, point2: THREE.Vector3, point3: THREE.Vector3, steps = 64): THREE.Vector3[] | null {
    const circleParams = ArcItem.circleFromThreePointsOnPlane(point1, point2, point3);
    if (!circleParams) return null;
    const { center, radius, basisU, basisV } = circleParams;

    const d = 2 * (A.x*(B.y-C.y) + B.x*(C.y-A.y) + C.x*(A.y-B.y));
    if (Math.abs(d) < 1e-12) return null;

    const angleAtPoint1 = ArcItem.angleOnBasisUV(center, point1, basisU, basisV);
    const angleAtPoint2 = ArcItem.angleOnBasisUV(center, point2, basisU, basisV);
    const angleAtPoint3 = ArcItem.angleOnBasisUV(center, point3, basisU, basisV);

    // 选择包含 point3 的 CCW 弧段
    let startAngle = angleAtPoint1, endAngle = angleAtPoint2;
    if (!ArcItem.isAngleBetweenCCW(startAngle, endAngle, angleAtPoint3)) {
      startAngle = angleAtPoint2; endAngle = angleAtPoint1;
      if (!ArcItem.isAngleBetweenCCW(startAngle, endAngle, angleAtPoint3)) return null;
    }

    let normalizedStart = ArcItem.normalizeAngle(startAngle);
    let normalizedEnd = ArcItem.normalizeAngle(endAngle);
    if (normalizedEnd < normalizedStart) normalizedEnd += Math.PI * 2;

    const arcPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = normalizedStart + (normalizedEnd - normalizedStart) * t;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      arcPoints.push(center.clone().add(basisU.clone().multiplyScalar(x)).add(basisV.clone().multiplyScalar(y)));
    }

    this.startAngle = normalizedStart;
    this.endAngle = normalizedEnd;
    return arcPoints;
  }

  // === 点生成 ===
  private buildPoints(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, steps = 64) {
    let circle = this.mode === 'threePoints' ? this.computeCircleThreePoints(p1,p2,p3) : this.computeCircleCenterStartEnd(p1,p2,p3);
    if (!circle) return null;
    const { center: computedCenter, radius: computedRadius, basisU, basisV } = circle;

    this.center = computedCenter.clone();
    this.radius = computedRadius;

    // 计算起点/终点在 basisU,basisV 下的极角（不做预先规范化）
    const angleStartRaw = ArcItem.angleOnBasisUV(computedCenter, start, basisU, basisV);
    const angleEndRaw = ArcItem.angleOnBasisUV(computedCenter, end, basisU, basisV);

    const twoPI = Math.PI * 2;
    const EPS = 1e-9;

    // 以逆时针为方向，计算从 angleStartRaw 到 angleEndRaw 的角增量 delta（范围 [0, 2PI)）
    let delta = ((angleEndRaw - angleStartRaw) % twoPI + twoPI) % twoPI;

    // 若几乎无弧（接近 0）或接近完整圆（>= 2PI），则视为不可绘制
    if (delta <= EPS) return null;
    if (delta >= twoPI - 1e-6) return null;

    // 生成从 angleStartRaw 逆时针到 angleStartRaw + delta 的点（允许 delta > PI）
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const ang = angleStartRaw + delta * t;
      const x = Math.cos(ang) * computedRadius;
      const y = Math.sin(ang) * computedRadius;
      pts.push(computedCenter.clone().add(basisU.clone().multiplyScalar(x)).add(basisV.clone().multiplyScalar(y)));
    }

    // 记录角度范围：startAngle 规范化为 [0,2π)，endAngle = start + delta（可 > 2π）
    this.startAngle = ArcItem.normalizeAngle(angleStartRaw);
    this.endAngle = this.startAngle + delta;
    return pts;
  }

  // 在场景中添加一个小球作为圆心标记（用于 centerStartEnd 预览），并高亮显示
  private addCenterMarker(scene: THREE.Scene, position: THREE.Vector3) {
    this.clearCenterMarker(scene);
    const size = Math.max(0.01, (this.radius || 1) * 0.02);
    const geom = new THREE.SphereGeometry(size, 10, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(position);
    mesh.userData.isSketchItem = true;
    // 做为高亮，设置 userData.type 方便选择器识别（若需要）
    mesh.userData.type = 'center';
    scene.add(mesh);
    this.centerMarker = mesh;
  }

  private clearCenterMarker(scene?: THREE.Scene) {
    if (this.centerMarker && scene) {
      try { scene.remove(this.centerMarker); } catch {}
    }
    this.centerMarker = undefined;
  }

  // 最终绘制（固定端点 P1/P2，P3 决定弧；或 Center/Start/End）
  draw(scene: THREE.Scene) {
    // 绘制前移除预览（包含可能的中心标记）
    this.remove(scene);
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = dashed ? new THREE.LineDashedMaterial({ color: 0x00ccff, dashSize:1, gapSize:0.5 })
                       : new THREE.LineBasicMaterial({ color:0x00ffff });
    const line = new THREE.Line(geom, mat);
    if (dashed) line.computeLineDistances();
    line.userData.isSketchItem = true;
    this.object3D = line;
    scene.add(line);
  }

  draw(scene: THREE.Scene) {
    if (!this.points || this.points.length < 2) return;
    const pts = this.buildPoints(...(this.points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]));
    if (pts) this.drawLine(scene, pts);
  }

  drawPreview(scene: THREE.Scene, cursorPos?: THREE.Vector3) {
    // 预览开始前移除旧 preview 与中心标记
    this.remove(scene);
    if (!cursorPos || !this.points) return;

    let pts: THREE.Vector3[] | null = null;
    if (this.mode === 'centerStartEnd') {
      if (this.points.length < 2) return;
      const center = this.points[0];
      const start = this.points[1];
      pts = this.buildArcPointsCenterStartEnd(center, start, cursorPos);
      // 显示圆心标记并高亮
      if (this.center) {
        // this.radius 在 buildArcPointsCenterStartEnd 中已被设置
        this.addCenterMarker(scene, this.center);
      } else {
        this.clearCenterMarker(scene);
      }
    } else {
      if (this.points.length < 2) return;
      const p1 = this.points[0];
      const p2 = this.points[1];
      pts = this.buildArcPointsBetween(p1, p2, cursorPos);
      // threePoints 模式不显示圆心标记（按要求仅中心弧显示）
      this.clearCenterMarker(scene);
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

  // 覆盖移除，确保预览中心点也被清理
  remove(scene: THREE.Scene) {
    try { super.remove(scene); } catch {}
    this.clearCenterMarker(scene);
  }

  toJSON() {
    return {
      type:'arc', mode:this.mode,
      points:this.points.map(p=>p.toArray()),
      center:this.center?.toArray()||null,
      radius:this.radius||0,
      startAngle:this.startAngle??null,
      endAngle:this.endAngle??null
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
   * Arc 工具统一处理（供 sketch 工具调用）
   * - app: 应用实例（用于 scene 等）
   * - manager: sketch 管理器，需包含 previewItem、sketchItems 等（sketchItems 为 Ref<Array>）
   * - intersect: 当前拾取点（THREE.Vector3）
   * - mode: 'threePoints' | 'centerStartEnd'
   * - plane: 可选拾取平面（目前仅用于兼容接口）
   */
  static handleArcTool(app: any, manager: any, intersectionPoint: THREE.Vector3, mode: ArcMode, plane?: THREE.Plane) {
    const pickedPoint = intersectionPoint.clone();
    // 三点弧：P1 -> P2 -> P3
    if (mode === 'threePoints') {
      if (!manager.previewItem || !(manager.previewItem instanceof ArcItem)) {
        manager.previewItem = new ArcItem([pickedPoint], 'threePoints');
      } else {
        const previewArc = manager.previewItem as ArcItem;
        previewArc.setMode('threePoints');
        if (!previewArc.points) previewArc.points = [];
        if (previewArc.points.length === 0) {
          previewArc.points.push(pickedPoint);
        } else if (previewArc.points.length === 1) {
          previewArc.points.push(pickedPoint);
        } else if (previewArc.points.length === 2) {
          previewArc.points.push(pickedPoint);
          // finalize
          previewArc.remove(app.scene);
          previewArc.draw(app.scene);
          if (manager.sketchItems && Array.isArray(manager.sketchItems.value)) {
            manager.sketchItems.value.push(previewArc);
          }
          manager.previewItem = null;
        }
      }
    } else {
      // 中心弧：Center -> Start -> End
      if (!manager.previewItem || !(manager.previewItem instanceof ArcItem)) {
        manager.previewItem = new ArcItem([pickedPoint], 'centerStartEnd');
      } else {
        const previewArc = manager.previewItem as ArcItem;
        previewArc.setMode('centerStartEnd');
        if (!previewArc.points) previewArc.points = [];
        if (previewArc.points.length === 0) {
          previewArc.points.push(pickedPoint); // Center
        } else if (previewArc.points.length === 1) {
          previewArc.points.push(pickedPoint); // Start（定义半径方向）
        } else if (previewArc.points.length === 2) {
          previewArc.points.push(pickedPoint); // End
          // finalize
          previewArc.remove(app.scene);
          previewArc.draw(app.scene);
          if (manager.sketchItems && Array.isArray(manager.sketchItems.value)) {
            manager.sketchItems.value.push(previewArc);
          }
          manager.previewItem = null;
        }
      }
    }
  }
}