// RectItem.ts
import * as THREE from 'three';
import { SketchItem } from './SketchItem';

type RectMode = 'twoPoint' | 'threePoint';
function normalizeMode(mode: any): RectMode {
  return (mode === 'three-point' || mode === 'threePoint') ? 'threePoint' : 'twoPoint';
}

export class RectItem extends SketchItem {
  public mode: RectMode;
  public start?: THREE.Vector3;
  public end?: THREE.Vector3;     // 两点对角 / 三点中心线终点
  public p3?: THREE.Vector3;      // 三点宽度点
  public corners: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] | null = null;

  // 交互阶段：
  // twoPoint: 0(已有start，预览) -> 完成
  // threePoint: 0(中心线预览) -> 1(宽度预览) -> 完成
  public stage: 0 | 1 | 2 = 0;

  // 仅预览使用（不写入最终）
  private previewEnd?: THREE.Vector3; // 两点/三点中心线预览点
  private previewP3?: THREE.Vector3;  // 三点宽度预览点

  // 预览对象缓存（虚线）
  private previewLine?: THREE.Line;   // 中心线
  private previewRect?: THREE.Line;   // 矩形

  constructor(
    mode: RectMode | string,
    start?: THREE.Vector3,
    end?: THREE.Vector3,
    p3?: THREE.Vector3,
    planeNormal?: THREE.Vector3
  ) {
    super('rect');
    this.mode = normalizeMode(mode);
    this.start = start?.clone();
    this.end = end?.clone();
    this.p3 = p3?.clone();
    this.planeNormal = (planeNormal?.clone() ?? new THREE.Vector3(0, 0, 1)).normalize();
    if (this.start && this.end && (this.mode === 'twoPoint' || (this.mode === 'threePoint' && this.p3))) {
      this.computeCorners();
    }
  }

  // 基向量（与草图平面一致）
  private static basisFromNormal(planeNormal: THREE.Vector3) {
    const normal = planeNormal.clone().normalize();
    const ref = Math.abs(normal.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(normal, ref).normalize();
    const v = new THREE.Vector3().crossVectors(normal, u).normalize();
    return { u, v, n: normal };
  }

  private makeCornersTwoPoint(pointA: THREE.Vector3, pointB: THREE.Vector3): [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] {
    // 通过草图平面法向量获得正交基
    const { u: axisU, v: axisV } = RectItem.basisFromNormal(this.planeNormal!);
    // 计算对角线中点
    const mid = new THREE.Vector3().addVectors(pointA, pointB).multiplyScalar(0.5);
    // 计算对角线向量的一半
    const half = new THREE.Vector3().subVectors(pointB, pointA).multiplyScalar(0.5);
    // 在正交基上的投影长度
    const du = half.dot(axisU);
    const dv = half.dot(axisV);
    // 沿正交基方向的向量
    const U = axisU.clone().multiplyScalar(du);
    const V = axisV.clone().multiplyScalar(dv);
    // 计算四个角点
    const cornerA = mid.clone().add(U).add(V);
    const cornerB = mid.clone().sub(U).add(V);
    const cornerC = mid.clone().sub(U).sub(V);
    const cornerD = mid.clone().add(U).sub(V);
    // 返回四个角点
    return [cornerA, cornerB, cornerC, cornerD];
  }

  computeCorners(): [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] {
    if (!this.start || !this.end) {
      const zero = new THREE.Vector3();
      this.corners = [zero, zero.clone(), zero.clone(), zero.clone()];
      return this.corners;
    }
    if (this.mode === 'twoPoint') {
      this.corners = this.makeCornersTwoPoint(this.start, this.end);
      return this.corners;
    }
    if (this.mode === 'threePoint' && this.p3) {
      const point1 = this.start.clone();
      const point2 = this.end.clone();
      const normal = this.planeNormal!.clone().normalize();
      const tangent = new THREE.Vector3().subVectors(point2, point1);
      const length = tangent.length();
      if (length < 1e-8) {
        this.corners = [point1, point1.clone(), point1.clone(), point1.clone()];
        return this.corners;
      }
      tangent.divideScalar(length);
      let axisU = new THREE.Vector3().crossVectors(normal, tangent);
      if (axisU.lengthSq() < 1e-12) {
        const alt = Math.abs(normal.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        axisU = new THREE.Vector3().crossVectors(normal, alt).normalize();
      } else axisU.normalize();
      const mid = new THREE.Vector3().addVectors(point1, point2).multiplyScalar(0.5);
      const halfWidth = new THREE.Vector3().subVectors(this.p3.clone(), mid).dot(axisU);
      // 避免退化（半宽为0时给微小偏移）
      const offset = axisU.clone().multiplyScalar(Math.abs(halfWidth) < 1e-9 ? (halfWidth >= 0 ? 1e-6 : -1e-6) : halfWidth);
      const cornerA = point1.clone().add(offset);
      const cornerB = point2.clone().add(offset);
      const cornerC = point2.clone().sub(offset);
      const cornerD = point1.clone().sub(offset);
      this.corners = [cornerA, cornerB, cornerC, cornerD];
      return this.corners;
    }
    const zero = new THREE.Vector3();
    this.corners = [zero, zero.clone(), zero.clone(), zero.clone()];
    return this.corners;
  }

  // ---------- 预览对象复用 ----------
  private ensurePreviewLine(scene: THREE.Scene) {
    if (this.previewLine) return;
    const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const mat = new THREE.LineDashedMaterial({ color: 0x00ffff, dashSize: 0.6, gapSize: 0.3 });
    const line = new THREE.Line(geom, mat);
    (line as any).computeLineDistances?.();
    line.userData.isSketchPreview = true;
    this.previewLine = line;
    scene.add(line);
  }
  private updatePreviewLine(startPoint: THREE.Vector3, endPoint: THREE.Vector3) {
    if (!this.previewLine) return;
    const pos = (this.previewLine.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, startPoint.x, startPoint.y, startPoint.z);
    pos.setXYZ(1, endPoint.x, endPoint.y, endPoint.z);
    pos.needsUpdate = true;
    (this.previewLine as any).computeLineDistances?.();
  }

  private ensurePreviewRect(scene: THREE.Scene) {
    if (this.previewRect) return;
    // 5点闭合
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 3), 3));
    const mat = new THREE.LineDashedMaterial({ color: 0x00ffff, dashSize: 0.6, gapSize: 0.3 });
    const line = new THREE.Line(geom, mat);
    (line as any).computeLineDistances?.();
    line.userData.isSketchPreview = true;
    this.previewRect = line;
    scene.add(line);
  }
  private updatePreviewRect(corners: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3]) {
    if (!this.previewRect) return;
    const pos = (this.previewRect.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < 4; i++) pos.setXYZ(i, corners[i].x, corners[i].y, corners[i].z);
    pos.setXYZ(4, corners[0].x, corners[0].y, corners[0].z);
    pos.needsUpdate = true;
    (this.previewRect as any).computeLineDistances?.();
  }
  private removePreview(scene: THREE.Scene) {
    if (this.previewLine) {
      try { scene.remove(this.previewLine); } catch {}
      this.previewLine.geometry.dispose();
      (this.previewLine.material as any).dispose?.();
      this.previewLine = undefined;
    }
    if (this.previewRect) {
      try { scene.remove(this.previewRect); } catch {}
      this.previewRect.geometry.dispose();
      (this.previewRect.material as any).dispose?.();
      this.previewRect = undefined;
    }
  }

  // --------- 最终绘制 ---------
  remove(scene: THREE.Scene) {
    // 移除最终绘制对象
    if (this.object3D) {
      try { scene.remove(this.object3D); } catch {}
      if ((this.object3D as any).geometry) (this.object3D as any).geometry.dispose();
      if ((this.object3D as any).material && (this.object3D as any).material.dispose) (this.object3D as any).material.dispose();
      this.object3D = undefined as any;
    }
    // 清除可能残留的预览对象
    this.removePreview(scene);
  }

  draw(scene: THREE.Scene) {
    // 这里只绘制最终对象，不在此创建预览
    if (!this.corners) this.computeCorners();
    if (!this.corners) return;
    this.remove(scene);
    const points = [...this.corners, this.corners[0]];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffff });
    const line = new THREE.Line(geom, mat);
    line.userData.isSketchItem = true;
    this.object3D = line;
    scene.add(line);
  }

  // --------- 实时预览（由 mousemove 调用） ---------
  drawPreview(scene: THREE.Scene, cursorPos?: THREE.Vector3) {
    if (!cursorPos || !this.start) return;

    if (this.mode === 'twoPoint') {
      if (this.stage !== 0) return;
      this.previewEnd = cursorPos.clone();
      const corners = this.makeCornersTwoPoint(this.start, this.previewEnd);
      this.ensurePreviewRect(scene);
      this.updatePreviewRect(corners);
      return;
    }

    if (this.mode === 'threePoint') {
      if (this.stage === 0) {
        // 中心线预览
        this.previewEnd = cursorPos.clone();
        this.ensurePreviewLine(scene);
        this.updatePreviewLine(this.start.clone(), this.previewEnd.clone());
        return;
      }
      if (this.stage === 1 && this.end) {
        // 宽度预览：临时用 cursor 做 p3
        this.previewP3 = cursorPos.clone();
        const savedP3 = this.p3;
        this.p3 = this.previewP3;
        const corners = this.computeCorners();
        this.p3 = savedP3;
        this.ensurePreviewRect(scene);
        this.updatePreviewRect(corners);
        return;
      }
    }
  }

  // --------- 点击推进（由 mousedown 调用） ---------
  static handleRectTool(app: any, manager: any, hit: THREE.Vector3, modeIn: RectMode | string, plane?: THREE.Plane) {
    const mode = normalizeMode(modeIn);
    const planeNormal = plane?.normal?.clone() ?? new THREE.Vector3(0, 0, 1);

    // 初始化（第一次点击）
    if (!manager.previewItem || !(manager.previewItem instanceof RectItem) || manager.previewItem.mode !== mode) {
      const newRectItem = new RectItem(mode, hit.clone(), undefined, undefined, planeNormal);
      // 开启预览阶段
      newRectItem.stage = 0;
      manager.previewItem = newRectItem;
      return;
    }

    const previewRectItem = manager.previewItem as RectItem;

    if (mode === 'twoPoint') {
      if (previewRectItem.stage === 0) {
        // 第二次点击：完成
        previewRectItem.end = (previewRectItem.previewEnd ?? hit).clone();
        previewRectItem.computeCorners();
        previewRectItem.removePreview(app.scene);

        // 构造最终矩形对象
        const finalRect = new RectItem(
          'twoPoint',
          previewRectItem.start!.clone(),
          previewRectItem.end.clone(),
          undefined,
          previewRectItem.planeNormal!.clone()
        );
        finalRect.computeCorners();
        finalRect.draw(app.scene);
        pushSketchItem(manager, finalRect);

        // 连续绘制：仅清理预览，不退出工具
        manager.previewItem = null;
        app.renderOnce?.();
      }
      return;
    }

    if (mode === 'threePoint') {
      if (previewRectItem.stage === 0) {
        // 第二次点击：锁定中心线终点，进入宽度预览
        previewRectItem.end = (previewRectItem.previewEnd ?? hit).clone();
        previewRectItem.stage = 1;
        // 切换预览形态，下一步预览宽度
        previewRectItem.removePreview(app.scene);
        app.renderOnce?.();
        return;
      }
      if (previewRectItem.stage === 1) {
        // 第三次点击：锁定宽度点，完成
        previewRectItem.p3 = (previewRectItem.previewP3 ?? hit).clone();
        previewRectItem.computeCorners();
        previewRectItem.removePreview(app.scene);

        // 构造最终三点矩形对象
        const finalRect = new RectItem(
          'threePoint',
          previewRectItem.start!.clone(),
          previewRectItem.end!.clone(),
          previewRectItem.p3!.clone(),
          previewRectItem.planeNormal!.clone()
        );
        finalRect.computeCorners();
        finalRect.draw(app.scene);
        pushSketchItem(manager, finalRect);

        // 连续绘制：仅清理预览，不退出工具
        manager.previewItem = null;
        app.renderOnce?.();
        return;
      }
    }
  }

  // --------- 序列化 ---------
  toJSON() {
    return {
      type: 'rect',
      mode: this.mode,
      start: this.start?.toArray() ?? null,
      end: this.end?.toArray() ?? null,
      p3: this.p3?.toArray() ?? null,
      planeNormal: this.planeNormal?.toArray() ?? null,
      corners: this.corners?.map(corner => corner.toArray()) ?? null
    };
  }

  static fromJSON(data: any): RectItem {
    const start = data.start ? new THREE.Vector3(...data.start) : undefined;
    const end = data.end ? new THREE.Vector3(...data.end) : undefined;
    const p3 = data.p3 ? new THREE.Vector3(...data.p3) : undefined;
    const planeNormal = data.planeNormal ? new THREE.Vector3(...data.planeNormal) : undefined;
    const item = new RectItem(normalizeMode(data.mode), start, end, p3, planeNormal);
    if (!item.corners && start && end && (item.mode === 'twoPoint' || (item.mode === 'threePoint' && p3))) {
      item.computeCorners();
    }
    return item;
  }
}

function pushSketchItem(manager: any, item: any) {
  try {
    if (manager.sketch.items.push) manager.sketch.items.push(item);
    else manager.sketch.items.push(item);
  } catch {}
}
