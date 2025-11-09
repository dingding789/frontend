// RectItem.ts
import * as THREE from 'three';
import { SketchItem } from './SketchItem';

type RectMode = 'twoPoint' | 'threePoint';

export class RectItem extends SketchItem {
  public corners: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] | null = null;
  public start?: THREE.Vector3;  // 对角/中心线起点
  public end?: THREE.Vector3;    // 对角/中心线终点或临时预览点
  public p3?: THREE.Vector3;     // 三点法的第三点
  public planeNormal?: THREE.Vector3; // 三点法所在平面
  public mode: RectMode;

  constructor(
    mode: RectMode,
    start?: THREE.Vector3,
    end?: THREE.Vector3,
    p3?: THREE.Vector3,
    planeNormal?: THREE.Vector3
  ) {
    super('rect');
    this.mode = mode;
    this.start = start?.clone();
    this.end = end?.clone();
    this.p3 = p3?.clone();
    this.planeNormal = planeNormal?.clone();
    if (start && end && (!p3 || mode === 'twoPoint')) {
      this.computeCorners();
    }
  }

  /** 计算矩形四角 */
  computeCorners(): [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] {
    if (!this.start || !this.end) {
      const zero = new THREE.Vector3();
      this.corners = [zero, zero.clone(), zero.clone(), zero.clone()];
      return this.corners;
    }

    if (this.mode === 'twoPoint') {
      const a = this.start.clone();
      const c = this.end.clone();
      const eps = 1e-6;
      let constAxis: 'x' | 'y' | 'z' = 'z';
      if (Math.abs(a.x - c.x) < eps) constAxis = 'x';
      else if (Math.abs(a.y - c.y) < eps) constAxis = 'y';

      let b: THREE.Vector3, d: THREE.Vector3;
      if (constAxis === 'z') {
        const z = a.z;
        b = new THREE.Vector3(a.x, c.y, z);
        d = new THREE.Vector3(c.x, a.y, z);
      } else if (constAxis === 'x') {
        const x = a.x;
        b = new THREE.Vector3(x, a.y, c.z);
        d = new THREE.Vector3(x, c.y, a.z);
      } else {
        const y = a.y;
        b = new THREE.Vector3(a.x, y, c.z);
        d = new THREE.Vector3(c.x, y, a.z);
      }
      this.corners = [a, b, c, d];
      return this.corners;
    }

    // 三点法中心线法
    if (this.mode === 'threePoint' && this.start && this.end && this.p3 && this.planeNormal) {
      const p1 = this.start.clone();
      const p2 = this.end.clone();
      const p3 = this.p3.clone();
      const n = this.planeNormal.clone().normalize();
      const t = new THREE.Vector3().subVectors(p2, p1);
      const len = t.length();
      if (len < 1e-6) {
        this.corners = [p1, p1.clone(), p1.clone(), p1.clone()];
        return this.corners;
      }
      t.divideScalar(len);
      let u = new THREE.Vector3().crossVectors(n, t);
      if (u.lengthSq() < 1e-6) {
        const axis = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        u = new THREE.Vector3().crossVectors(n, axis).normalize();
      } else u.normalize();

      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const halfW = new THREE.Vector3().subVectors(p3, mid).dot(u);

      const off = u.clone().multiplyScalar(halfW);
      const A = p1.clone().add(off);
      const B = p2.clone().add(off);
      const C = p2.clone().sub(off);
      const D = p1.clone().sub(off);
      this.corners = [A, B, C, D];
      return this.corners;
    }

    // fallback
    const zero = new THREE.Vector3();
    this.corners = [zero, zero.clone(), zero.clone(), zero.clone()];
    return this.corners;
  }

  draw(scene: THREE.Scene) {
    this.remove(scene);
    if (!this.corners) this.computeCorners();
    if (!this.corners) return;

    const pts = [...this.corners, this.corners[0]];
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffff });
    const line = new THREE.Line(geom, mat);
    line.userData.isSketchItem = true;
    this.object3D = line;
    scene.add(this.object3D);
  }

  drawPreview(scene: THREE.Scene, cursorPos?: THREE.Vector3) {
    this.remove(scene);
    if (!cursorPos) return;

    if (this.mode === 'twoPoint') {
      this.end = cursorPos.clone();
    } else if (this.mode === 'threePoint') {
      if (!this.end) {
        this.end = cursorPos.clone(); // 第二点预览中心线
        const geom = new THREE.BufferGeometry().setFromPoints([this.start!.clone(), this.end.clone()]);
        const mat = new THREE.LineDashedMaterial({ color: 0x00ffff, dashSize: 1, gapSize: 0.5 });
        const line = new THREE.Line(geom, mat);
        line.computeLineDistances();
        // 标记为预览对象，便于调试和区分
        (line as any).userData = (line as any).userData || {};
        (line as any).userData.isSketchPreview = true;
        this.object3D = line;
        scene.add(this.object3D);
        return;
      } else {
        this.p3 = cursorPos.clone();
      }
    }

    this.computeCorners();
    if (!this.corners) return;

    const pts = [...this.corners, this.corners[0]];
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({ color: 0x00ffff, dashSize: 1, gapSize: 0.5 });
    const line = new THREE.Line(geom, mat);
    line.computeLineDistances();
    // 标记为预览对象
    (line as any).userData = (line as any).userData || {};
    (line as any).userData.isSketchPreview = true;
    this.object3D = line;
    scene.add(this.object3D);
  }

  toJSON() {
    return {
      type: 'rect',
      mode: this.mode,
      start: this.start?.toArray() ?? null,
      end: this.end?.toArray() ?? null,
      p3: this.p3?.toArray() ?? null,
      planeNormal: this.planeNormal?.toArray() ?? null,
      corners: this.corners?.map(c => c.toArray()) ?? null,
    };
  }

  static fromJSON(data: any): RectItem {
    const start = data.start ? new THREE.Vector3(...data.start) : undefined;
    const end = data.end ? new THREE.Vector3(...data.end) : undefined;
    const p3 = data.p3 ? new THREE.Vector3(...data.p3) : undefined;
    const planeNormal = data.planeNormal ? new THREE.Vector3(...data.planeNormal) : undefined;
    return new RectItem(data.mode || 'twoPoint', start, end, p3, planeNormal);
  }

  /** 草图交互工具 */
  static handleRectTool(app: any, manager: any, intersect: THREE.Vector3, mode: RectMode, plane?: THREE.Plane) {
    console.log('handleRectTool called');

    if (!manager.previewItem || !(manager.previewItem instanceof RectItem) || manager.previewItem.mode !== mode) {
      const planeNormal = plane?.normal.clone() ?? new THREE.Vector3(0, 0, 1);
      manager.previewItem = new RectItem(mode, intersect.clone(), undefined, undefined, planeNormal);
      // 立即绘制预览（初始位置）并触发渲染，保证用户能看到预览
      if (manager.previewItem && typeof manager.previewItem.drawPreview === 'function') {
        manager.previewItem.drawPreview(app.scene, intersect.clone());
        app.renderOnce();
      }
    } else {
      const r = manager.previewItem as RectItem;
      if (mode === 'twoPoint') {
        console.log('finalizing twoPoint rect');
        r.end = intersect.clone();
        // remove preview visuals
        r.remove(app.scene);

        // ensure corners computed
        r.computeCorners();
        if (!r.corners) {
          console.error('RectItem: computeCorners failed');
          manager.previewItem = null;
          return;
        }

        // create a fresh item for storage/drawing (avoid preview state leaking)
        const finalRect = new RectItem('twoPoint', r.start?.clone(), r.end?.clone(), undefined, r.planeNormal?.clone());
        finalRect.computeCorners();
        finalRect.draw(app.scene);

        manager.sketchItems.value.push(finalRect);
        manager.previewItem = null;

        // ensure scene updates
        app.renderOnce();
      } else {
        // threePoint mode
        if (!r.end) {
          // set second point (centerline end)
          r.end = intersect.clone();
        } else {
          // finalize with third point
          r.p3 = intersect.clone();
          r.remove(app.scene);

          r.computeCorners();
          if (!r.corners) {
            console.error('RectItem: computeCornersFromCenterline failed');
            manager.previewItem = null;
            return;
          }

          const finalRect = new RectItem('threePoint', r.start?.clone(), r.end?.clone(), r.p3?.clone(), r.planeNormal?.clone());
          finalRect.computeCorners();
          finalRect.draw(app.scene);

          manager.sketchItems.value.push(finalRect);
          manager.previewItem = null;

          app.renderOnce();
        }
      }
    }
  }
}
