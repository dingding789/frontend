import * as THREE from 'three';
import { SketchItem } from './SketchItem';

/**
 * RectItem
 * 表示具有任意方向的矩形（通过四个角点）
 * 支持多种序列化格式，包含绘制、预览、数据转换等方法
 * 静态方法 handleRectTool 用于草图交互逻辑
 */

/**
 * RectItem: 表示具有任意方向的矩形（通过四个角点）
 * - 保存 corners: [A,B,C,D]
 * - draw() 会绘制闭合线环
 * - toJSON()/fromJSON() 支持 corners 字段（优先），并兼容老的 start/end 对角点格式
 */
export class RectItem extends SketchItem {
  public corners: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];

  constructor(A: THREE.Vector3, B: THREE.Vector3, C: THREE.Vector3, D: THREE.Vector3) {
    super("rect");
    this.corners = [A.clone(), B.clone(), C.clone(), D.clone()];
  }

  draw(scene: THREE.Scene) {
    this.remove(scene);
    const pts = [...this.corners, this.corners[0]];
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffff });
    const line = new THREE.Line(geom, mat);
    this.object3D = line;
    this.object3D.userData.isSketchItem = true;
    scene.add(this.object3D);
  }

  drawPreview(scene: THREE.Scene, cursorPos?: THREE.Vector3) {
    // preview 与正式绘制相同（此类主要用作最终项）
    this.draw(scene);
  }

  toJSON() {
    // 同时包含兼容字段：corners（完整四角）以及 start/end（对角）
    // 另外加入简洁描述 rectSpec，便于后端以更小的数据量保存矩形：
    // rectSpec = { center: [x,y,z], width: number, height: number, dir: [ux,uy,uz], normal?: [nx,ny,nz] }
    const corners = this.corners.map(c => c.toArray());
    const start = this.corners[0].toArray();
    const end = this.corners[2].toArray();

    // 计算中心、宽高、方向与法向
    const A = this.corners[0];
    const B = this.corners[1];
    const C = this.corners[2];
    const center = new THREE.Vector3().addVectors(A, C).multiplyScalar(0.5).toArray();
    const width = A.distanceTo(B);
    const height = B.distanceTo(C);
    const dirVec = new THREE.Vector3().subVectors(B, A);
    const dirLen = dirVec.length() || 1;
    const dir = dirVec.clone().divideScalar(dirLen).toArray();
    // 法向按 AB x AD
    const AD = new THREE.Vector3().subVectors(this.corners[3], A);
    const normal = new THREE.Vector3().crossVectors(dirVec, AD).normalize().toArray();

    return {
      type: 'rect',
      corners,
      start,
      end,
      rectSpec: {
        center,
        width,
        height,
        dir,
        normal,
      },
    };
  }

  static fromJSON(data: any): RectItem {
    // 优先支持完整 corners
    if (Array.isArray(data?.corners) && data.corners.length === 4) {
      const [A, B, C, D] = data.corners.map((p: any) => new THREE.Vector3(...p));
      return new RectItem(A, B, C, D);
    }

    // 支持简洁格式 rectSpec
    if (data?.rectSpec) {
      try {
        const spec = data.rectSpec;
        const center = new THREE.Vector3(...(spec.center || [0, 0, 0]));
        const width = Number(spec.width) || 0;
        const height = Number(spec.height) || 0;
        const dirArr = Array.isArray(spec.dir) ? spec.dir : [1, 0, 0];
        const normalArr = Array.isArray(spec.normal) ? spec.normal : null;

        const dir = new THREE.Vector3(...dirArr).normalize();
        let normal = normalArr ? new THREE.Vector3(...normalArr).normalize() : null;
        if (!normal || normal.length() < 1e-6) {
          // 若未提供法向，则从 dir 选一稳定法向（优先 Z 方向或 X 轴组合）
          normal = Math.abs(dir.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
        }

        const u = dir.clone().multiplyScalar(width / 2);
        const v = new THREE.Vector3().crossVectors(normal, dir).normalize().multiplyScalar(height / 2);

        const A = center.clone().sub(u).sub(v);
        const B = center.clone().add(u).sub(v);
        const C = center.clone().add(u).add(v);
        const D = center.clone().sub(u).add(v);
        return new RectItem(A, B, C, D);
      } catch {
        // fallthrough
      }
    }

    // 兼容旧格式 start/end（对角），若不符合则返回一个退化的零尺寸矩形
    if (Array.isArray(data?.start) && Array.isArray(data?.end)) {
      const a = new THREE.Vector3(...data.start);
      const c = new THREE.Vector3(...data.end);
      // 简单按轴/平面组合生成四角，类似 RectPreviewItem.computeCorners
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
      return new RectItem(a, b, c, d);
    }

    // 退化为零矩形
    const z0 = 0;
    const p = new THREE.Vector3(0, 0, z0);
    return new RectItem(p, p.clone(), p.clone(), p.clone());
  }

  static handleRectTool(app: any, manager: any, intersect: THREE.Vector3, mode: string, plane: THREE.Plane) {
    if (mode === 'two-point') {
      const PreviewCtor = manager.RectPreviewItem;
      if (!PreviewCtor) throw new Error('RectPreviewItem 构造器未注册');
      if (!manager.previewItem || !(manager.previewItem instanceof PreviewCtor)) {
        manager.previewItem = new PreviewCtor(intersect.clone());
      } else {
        const r = manager.previewItem;
        r.end = intersect.clone();
        r.remove(app.scene);
        const a = r.start.clone();
        const c = r.end.clone();
        const [A, B, C, D] = r.constructor.computeCorners(a, c);
        const rect = new RectItem(A, B, C, D);
        rect.draw(app.scene);
        manager.sketchItems.value.push(rect);
        manager.previewItem = null;
      }
    } else {
      const planeNormal = plane?.normal.clone() ?? new THREE.Vector3(0,0,1);
      const PreviewCtor = manager.Rect3PreviewItem;
      if (!PreviewCtor) throw new Error('Rect3PreviewItem 构造器未注册');
      if (!manager.previewItem || !(manager.previewItem instanceof PreviewCtor)) {
        manager.previewItem = new PreviewCtor(intersect.clone(), planeNormal);
      } else {
        const r3 = manager.previewItem;
        if (!r3.p2) {
          r3.p2 = intersect.clone();
        } else {
          const p1 = r3.p1.clone();
          const p2 = r3.p2.clone();
          const p3 = intersect.clone();
          const [A, B, C, D] = r3.constructor.computeCornersFromCenterline(p1, p2, p3, planeNormal);
          r3.remove(app.scene);
          const rect3 = new RectItem(A.clone(), B.clone(), C.clone(), D.clone());
          rect3.draw(app.scene);
          manager.sketchItems.value.push(rect3);
          manager.previewItem = null;
        }
      }
    }
  }
}
