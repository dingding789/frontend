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

  constructor(
    public points: THREE.Vector3[] = [],
    public mode: ArcMode = 'threePoints'
  ) {
    super('arc');
  }

  setMode(mode: ArcMode) { this.mode = mode; }
  getCenter() { return this.center; }
  getRadius() { return this.radius; }
  getAngleRange() { return this.startAngle !== undefined && this.endAngle !== undefined ? { start: this.startAngle, end: this.endAngle } : undefined; }

  draw(scene: THREE.Scene) {
    // 三点圆弧：前两点仅显示直线
    if (this.mode === 'threePoints') {
      if (this.points.length === 1) return;
      if (this.points.length === 2) {
        this.drawLine(scene, [this.points[0], this.points[1]]);
        return;
      }
    }

    if (this.points.length < 2) return;
    const pts = this.buildPoints(
      this.points[0],
      this.points[1],
      this.points[2]
    );
    if (pts) this.drawLine(scene, pts);
  }

  drawPreview(scene: THREE.Scene, cursorPos: THREE.Vector3) {
    if (this.points.length < 1) return;

    if (this.mode === 'threePoints') {
      // 第一个点已确定：用光标显示直线预览
      if (this.points.length === 1) {
        this.drawLine(scene, [this.points[0], cursorPos], true);
        return;
      }
      // 前两个点已确定：显示它们的连线
      if (this.points.length === 2) {
        this.drawLine(scene, [this.points[0], this.points[1]], true);
        return;
      }
    } else if (this.mode === 'centerStartEnd') {
      // 圆心-起点-终点：只有圆心时显示半径线
      if (this.points.length === 1) {
        this.drawLine(scene, [this.points[0], cursorPos], true);
        return;
      }
    }

    const p1 = this.points[0];
    const p2 = this.points[1] || cursorPos;
    const p3 = cursorPos;
    const pts = this.buildPoints(p1, p2, p3);
    if (pts) this.drawLine(scene, pts, true);
  }

  toJSON() {
    return {
      type:'arc',
      mode:this.mode,
      points:this.points.map(p=>p.toArray()),
      center:this.center?.toArray() ?? null,
      radius:this.radius ?? 0,
      startAngle:this.startAngle ?? null,
      endAngle:this.endAngle ?? null
    };
  }

  static fromJSON(data: any) {
    const pts = (data.points || []).map((p: number[]) => new THREE.Vector3(...p));
    const arc = new ArcItem(pts, data.mode);
    if (data.center) arc.center = new THREE.Vector3(...data.center);
    arc.radius = data.radius;
    arc.startAngle = data.startAngle;
    arc.endAngle = data.endAngle;
    return arc;
  }


  // === 工具方法 ===

  /**
   * 将角度规范化到[0, 2π)范围内。
   *
   * @param a - 需要规范化的角度，单位为弧度
   * @returns 返回一个在[0, 2π)范围内的角度，单位为弧度
   */
  private static normAngle(a: number) {
    const twoPI = Math.PI * 2; // 2π 的值
    a = a % twoPI; // 将角度a对2π取模
    return a < 0 ? a + twoPI : a; // 如果结果小于0，则加上2π使其在[0, 2π)范围内
  }


   /**
   * 判断一个角度是否在另一个角度范围内（逆时针方向）。
   *
   * @param start - 范围的起始角度，单位为弧度
   * @param end - 范围的结束角度，单位为弧度
   * @param test - 需要测试的角度，单位为弧度
   * @returns 返回一个布尔值，表示test角度是否在[start, end]范围内（逆时针方向）
   */
  private static isAngleBetweenCCW(start: number, end: number, test: number) {
    const s = ArcItem.normAngle(start); // 将起始角度规范化到[0, 2π)范围内
    let e = ArcItem.normAngle(end); // 将结束角度规范化到[0, 2π)范围内
    const t = ArcItem.normAngle(test); // 将测试角度规范化到[0, 2π)范围内
    if (e < s) e += Math.PI * 2;
    let tt = t;
    if (tt < s) tt += Math.PI * 2;
    return tt >= s - 1e-12 && tt <= e + 1e-12;
  }


/**
   * 根据三个点计算圆的参数，包括圆心、半径、基底向量u和v以及法向量normal。
   *
   * @param p1 - 第一个点的3D坐标，类型为THREE.Vector3
   * @param p2 - 第二个点的3D坐标，类型为THREE.Vector3
   * @param p3 - 第三个点的3D坐标，类型为THREE.Vector3
   * @returns 返回一个包含圆心、半径、基底向量u、基底向量v和法向量normal的对象，如果无法计算圆则返回null
   */
  private computeCircleThreePoints(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) {
    const { normal, u, v } = this.makePlaneBasis(p1, p2, p3);
    const A = this.to2D(p1, p1, u, v);
    const B = this.to2D(p2, p1, u, v);
    const C = this.to2D(p3, p1, u, v);

    const d = 2 * (A.x*(B.y-C.y) + B.x*(C.y-A.y) + C.x*(A.y-B.y));
    if (Math.abs(d) < 1e-12) return null;

    const ux = (A.lengthSq()*(B.y-C.y) + B.lengthSq()*(C.y-A.y) + C.lengthSq()*(A.y-B.y)) / d;
    const uy = (A.lengthSq()*(C.x-B.x) + B.lengthSq()*(A.x-C.x) + C.lengthSq()*(B.x-A.x)) / d;

    const center = p1.clone().add(u.clone().multiplyScalar(ux)).add(v.clone().multiplyScalar(uy));
    const radius = center.distanceTo(p1);
    return { center, radius, u, v, normal };
  }
  /**
   * 根据圆心和两个点计算圆的参数，包括圆心、半径、基底向量u和v以及法向量normal。
   *
   * @param center - 圆心的3D坐标，类型为THREE.Vector3
   * @param start - 圆弧的起始点的3D坐标，类型为THREE.Vector3
   * @param end - 圆弧的结束点的3D坐标，类型为THREE.Vector3
   * @returns 返回一个包含圆心、半径、基底向量u、基底向量v和法向量normal的对象，如果无法计算圆则返回null
   */
  private computeCircleCenterStartEnd(center: THREE.Vector3, start: THREE.Vector3, end: THREE.Vector3) {
    const cs = new THREE.Vector3().subVectors(start, center);
    const ce = new THREE.Vector3().subVectors(end, center);
    let normal = new THREE.Vector3().crossVectors(cs, ce);
    if (normal.length() < 1e-12) normal.set(0,0,1); else normal.normalize();
    const u = cs.clone().sub(normal.clone().multiplyScalar(cs.dot(normal))).normalize();
    const v = new THREE.Vector3().crossVectors(normal, u).normalize();
    const radius = cs.length();
    if (radius < 1e-12) return null;
    return { center, radius, u, v, normal };
  }
  /**
   * 计算一个点相对于圆心在平面基底向量u和v上的角度。
   *
   * @param point - 需要计算角度的点，类型为THREE.Vector3
   * @returns 返回一个角度，单位为弧度，表示点相对于圆心在平面基底向量u和v上的角度
   */
  private angleOnUV(point: THREE.Vector3) {
    if (!this.center || !this.basisU || !this.basisV) return 0;
    const vec = new THREE.Vector3().subVectors(point, this.center);
    return Math.atan2(vec.dot(this.basisV), vec.dot(this.basisU));
  }

  // === 点生成 ===
  /**
   * 根据三个点生成圆弧上的点。
   *
   * @param p1 - 第一个点，类型为THREE.Vector3
   * @param p2 - 第二个点，类型为THREE.Vector3
   * @param p3 - 第三个点，类型为THREE.Vector3
   * @param steps - 圆弧上点的数量，默认为64
   * @returns 返回一个包含圆弧上点的数组，类型为THREE.Vector3[]
   */
  private buildPoints(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, steps = 64) {
    let circle = this.mode === 'threePoints' ? this.computeCircleThreePoints(p1,p2,p3) : this.computeCircleCenterStartEnd(p1,p2,p3);
    if (!circle) return null;
    this.center = circle.center.clone();
    this.radius = circle.radius;
    this.basisU = circle.u; this.basisV = circle.v;

    let aStart = this.mode === 'threePoints' ? this.angleOnUV(p1) : 0;
    let aEnd = this.mode === 'threePoints' ? this.angleOnUV(p2) : this.angleOnUV(p3);

    if (this.mode === 'threePoints') {
      const aTest = this.angleOnUV(p3);
      if (!ArcItem.isAngleBetweenCCW(aStart, aEnd, aTest)) [aStart,aEnd]=[aEnd,aStart];
    }

    aStart = ArcItem.normAngle(aStart); aEnd = ArcItem.normAngle(aEnd);
    if (aEnd < aStart) aEnd += Math.PI*2;
    this.startAngle = aStart; this.endAngle = aEnd;

    const pts: THREE.Vector3[] = [];
    for (let i=0;i<=steps;i++) {
      const t = i/steps;
      const ang = aStart + (aEnd-aStart)*t;
      pts.push(circle.center.clone().add(circle.u.clone().multiplyScalar(Math.cos(ang)*circle.radius)).add(circle.v.clone().multiplyScalar(Math.sin(ang)*circle.radius)));
    }
    return pts;
  }
  /**
   * 在场景中绘制一条线。
   *
   * @param scene - 用于绘制线的Three.js场景对象，类型为THREE.Scene
   * @param points - 组成线的点数组，类型为THREE.Vector3[]
   * @param dashed - 是否绘制虚线，默认为false
   */
  private drawLine(scene: THREE.Scene, points: THREE.Vector3[], dashed=false) {
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

}