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

  constructor(public points: THREE.Vector3[] = [], private mode: ArcMode = 'threePoints') {
    super('arc');
  }

  setMode(mode: ArcMode) { this.mode = mode; }
  getCenter() { return this.center; }
  getRadius() { return this.radius; }
  getAngleRange() { return this.startAngle !== undefined && this.endAngle !== undefined ? { start: this.startAngle, end: this.endAngle } : undefined; }

  // === 公用工具函数 ===
  private static makePlaneBasis(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) {
    const v12 = new THREE.Vector3().subVectors(p2, p1);
    const v13 = new THREE.Vector3().subVectors(p3, p1);
    let normal = new THREE.Vector3().crossVectors(v12, v13);
    const len = normal.length();
    if (len < 1e-12) normal.set(0, 0, 1); else normal.divideScalar(len);
    let u = v12.clone().sub(normal.clone().multiplyScalar(v12.dot(normal)));
    if (u.lengthSq() < 1e-12) u.set(1, 0, 0); else u.normalize();
    const v = new THREE.Vector3().crossVectors(normal, u).normalize();
    return { normal, u, v };
  }

  private static to2D(point: THREE.Vector3, origin: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3) {
    const vec = new THREE.Vector3().subVectors(point, origin);
    return new THREE.Vector2(vec.dot(u), vec.dot(v));
  }

  private static normAngle(a: number) {
    const twoPI = Math.PI * 2;
    a = a % twoPI;
    return a < 0 ? a + twoPI : a;
  }

  private static isAngleBetweenCCW(start: number, end: number, test: number) {
    const s = ArcItem.normAngle(start);
    let e = ArcItem.normAngle(end);
    const t = ArcItem.normAngle(test);
    if (e < s) e += Math.PI * 2;
    let tt = t; if (tt < s) tt += Math.PI * 2;
    return tt >= s - 1e-12 && tt <= e + 1e-12;
  }

  // === 圆计算 ===
  private computeCircleThreePoints(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) {
    const { normal, u, v } = ArcItem.makePlaneBasis(p1, p2, p3);
    const A = ArcItem.to2D(p1, p1, u, v);
    const B = ArcItem.to2D(p2, p1, u, v);
    const C = ArcItem.to2D(p3, p1, u, v);

    const d = 2 * (A.x*(B.y-C.y) + B.x*(C.y-A.y) + C.x*(A.y-B.y));
    if (Math.abs(d) < 1e-12) return null;

    const ux = (A.lengthSq()*(B.y-C.y) + B.lengthSq()*(C.y-A.y) + C.lengthSq()*(A.y-B.y)) / d;
    const uy = (A.lengthSq()*(C.x-B.x) + B.lengthSq()*(A.x-C.x) + C.lengthSq()*(B.x-A.x)) / d;

    const center = p1.clone().add(u.clone().multiplyScalar(ux)).add(v.clone().multiplyScalar(uy));
    const radius = center.distanceTo(p1);
    return { center, radius, u, v, normal };
  }

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

  private angleOnUV(point: THREE.Vector3) {
    if (!this.center || !this.basisU || !this.basisV) return 0;
    const vec = new THREE.Vector3().subVectors(point, this.center);
    return Math.atan2(vec.dot(this.basisV), vec.dot(this.basisU));
  }

  // === 点生成 ===
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

  draw(scene: THREE.Scene) {
    if (!this.points || this.points.length < 2) return;
    const pts = this.buildPoints(...(this.points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]));
    if (pts) this.drawLine(scene, pts);
  }

  drawPreview(scene: THREE.Scene, cursorPos?: THREE.Vector3) {
    if (!cursorPos || !this.points || this.points.length < 1) return;
    const pts = this.mode==='threePoints'
      ? this.buildPoints(this.points[0], this.points[1]||cursorPos, cursorPos)
      : this.buildPoints(this.points[0], this.points[1]||cursorPos, cursorPos);
    if (pts) this.drawLine(scene, pts, true);
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

  static fromJSON(data:any) {
    const pts: THREE.Vector3[] = Array.isArray(data.points)?data.points.map((a:any)=>new THREE.Vector3(...a)) : [];
    const arc = new ArcItem(pts, data.mode==='centerStartEnd'?'centerStartEnd':'threePoints');
    if (data.center) arc.center = new THREE.Vector3(...data.center);
    if (typeof data.radius==='number') arc.radius=data.radius;
    if (typeof data.startAngle==='number') arc.startAngle=data.startAngle;
    if (typeof data.endAngle==='number') arc.endAngle=data.endAngle;
    return arc;
  }

  static handleArcTool(app: App, manager: SketchManager, intersect: THREE.Vector3, mode: ArcMode) {
    const pt = intersect.clone();
    if (!manager.previewItem || !(manager.previewItem instanceof ArcItem)) {
      manager.previewItem = new ArcItem([pt], mode);
    } else {
      const a = manager.previewItem as ArcItem;
      a.setMode(mode);
      if (!a.points) a.points = [];
      a.points.push(pt);
      if ((mode==='threePoints' && a.points.length===3) || (mode==='centerStartEnd' && a.points.length===3)) {
        a.remove(app.scene); a.draw(app.scene);
        manager.sketchItems.value.push(a);
        manager.previewItem = null;
      }
    }
  }
}