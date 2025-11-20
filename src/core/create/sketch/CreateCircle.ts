// CreateCircle.ts (refactor)
import * as THREE from 'three';
import { CreateCommand } from '../CreateCommand';
import { CircleItem, CircleMode, calcCircleBy3PointsOnPlane } from '../../geometry/sketchs/CircleItem';

type WasmAny = any; // 根据你的项目替换为更精确的类型

export class CreateCircle extends CreateCommand {
  private mode: CircleMode;
  private planeNormal: THREE.Vector3;

  constructor(
    app: any,
    manager: any,
    mode: CircleMode = 'two-point',
    planeNormal: THREE.Vector3 = new THREE.Vector3(0, 0, 1)
  ) {
    super(app, manager);
    this.mode = mode;
    this.planeNormal = planeNormal.clone().normalize();
  }

  // ------------ input events ------------

  onClick(point: THREE.Vector3): void {
    this.points.push(point.clone());
    // 先更新预览以避免首帧无预览的问题
    this.updatePreview(point);

    if (this.mode === 'two-point') {
      if (this.points.length === 2) this.finish();
    } else {
      if (this.points.length === 3) this.finish();
    }
  }

  onMove(point: THREE.Vector3): void {
    this.updatePreview(point);
  }

  isFinished(): boolean {
    return this.mode === 'two-point' ? this.points.length >= 2 : this.points.length >= 3;
  }
  updatePreview(cursorPoint: THREE.Vector3): void {
    // 若还没有首点，先不画（点击后会再次被调用）
    if (this.points.length === 0) return;

    const first = this.points[0].clone();

    if (!this.previewItem) {
      if (this.mode === 'two-point') {
        this.previewItem = new CircleItem('two-point', first, cursorPoint.clone(), undefined, this.planeNormal.clone());
      } else {
        // 三点模式，初始化时使用 cursor 作为占位
        this.previewItem = new CircleItem('three-point', first, cursorPoint.clone(), cursorPoint.clone(), this.planeNormal.clone());
      }
      this.manager.previewItem = this.previewItem;
    }

    const circle = this.previewItem as CircleItem;

    if (this.mode === 'two-point') {
      circle.point1 = first;
      circle.point2 = cursorPoint.clone();
      circle.point3 = undefined;
    } else {
      if (this.points.length === 1) {
        circle.point1 = first;
        circle.point2 = cursorPoint.clone();
        circle.point3 = undefined;
      } else {
        circle.point1 = first;
        circle.point2 = this.points[1].clone();
        circle.point3 = cursorPoint.clone();
      }
    }

    // 重绘 preview: 先移除旧的，再绘制新的（CircleItem 自身负责绘制实现）
    try {
      circle.remove(this.app.scene);
    } catch {
      // ignore
    }
    circle.drawPreview(this.app.scene, cursorPoint);
  }


  createItem(): CircleItem | null {
    if (!this.isFinished()) return null;
    let circleCenter = new THREE.Vector3();
    let circleNormal = new THREE.Vector3();
    let radius = 0;
    if (this.mode === 'two-point') {
      const [p1, p2] = this.points;
      circleCenter = p1.clone();
      circleNormal = this.planeNormal.clone();
      radius = p1.distanceTo(p2);
      this.createTwoPointCircle(circleCenter, circleNormal, radius);
    return new CircleItem('two-point', p1.clone(), p2.clone(), undefined, this.planeNormal.clone());
 
    } else {
      const [p1, p2, p3] = this.points;
      const result = calcCircleBy3PointsOnPlane(p1, p2, p3, this.planeNormal);
      circleCenter = result.center;
      radius = result.radius;
      circleNormal = this.planeNormal.clone();
      this.createTwoPointCircle(circleCenter, circleNormal, radius);
      return new CircleItem('three-point', p1.clone(), p2.clone(), p3.clone(), this.planeNormal.clone());
    }
  }

  

  private createTwoPointCircle(center : THREE.Vector3 , normal : THREE.Vector3 , radius : number): void {
    


    const wasm = (this.app as any)?.wasm as WasmAny;




    // 调用 wasm 构造圆形（center, normal, radius）
    let rCircle;
    try {
      rCircle = wasm.ShapeFactory.circle(center, normal, radius);
    } catch (e) {
      console.warn('wasm ShapeFactory.circle 抛出异常，回退：', e);
      return;}

    if (!rCircle?.isOk) {
      console.warn('circle 创建失败:', rCircle?.error);
      return;}

    // 处理 shape（EDGE / WIRE）并尝试生成面
    const shape = rCircle.shape;
    const shapeType = this.safeGetShapeType(shape, wasm);
    const TopAbs = wasm.TopAbs_ShapeEnum;

    let topoWire: any | null = null;
    try {
      if (shapeType === TopAbs.TopAbs_EDGE.value) {
        const edge = wasm.TopoDS.edge(shape);
        const rWire = wasm.ShapeFactory.wire([edge]);
        if (!rWire?.isOk) throw new Error(rWire?.error ?? 'wire 创建返回非 isOk');
        topoWire = wasm.TopoDS.wire(rWire.shape);
      } else if (shapeType === TopAbs.TopAbs_WIRE.value) {
        topoWire = wasm.TopoDS.wire(shape);
      } else {
        console.warn('circle 返回的 shape 既不是 EDGE 也不是 WIRE，type =', shapeType);
      }
    } catch (e) {
      console.warn('构造 wire 失败:', e);
      topoWire = null;
    }

    // 尝试用 wire 生成 face（优先渲染面）
    let face: any | null = null;
    if (topoWire) {
      try {
        face = wasm.Wire.makeFace(topoWire);
      } catch (e) {
        console.warn('Wire.makeFace 失败，回退到线框渲染：', e);
        face = null;
      }
    }

    // 渲染（优先 face -> mesher -> mesh；失败回退到线框/edge）
    try {
      this.renderCircleFromWasm(shape, topoWire, face, center);
    } catch (e) {
      console.warn('渲染圆失败:', e);
    }

  }

 

  private safeGetShapeType(shape: any, wasm: WasmAny): number | undefined {
    try {
      return shape?.shapeType?.().value;
    } catch {
      // 某些绑定可能直接提供 shapeType 属性
      try {
        return (shape?.shapeType as any)?.value;
      } catch {
        return undefined;
      }
    }
  }

  private renderCircleFromWasm(shape: any, topoWire: any, face: any, circleCenter: THREE.Vector3) {
    const scene: THREE.Scene = this.app.scene;
    const wasm = (this.app as any).wasm as WasmAny;

    // 若有面，优先尝试 mesher -> THREE.Mesh
    if (face) {
      try {
        const mesher = new wasm.Mesher(face, 0.5);
        const meshData = mesher.mesh();

        const posArr = meshData.faceMeshData?.position ?? meshData.position;
        const idxArr = meshData.faceMeshData?.index ?? meshData.index;

        if (posArr && idxArr) {
          const geom = new THREE.BufferGeometry();
          geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(posArr), 3));
          // index 可能是 Uint16Array / Uint32Array - 根据 length 动态选择
          const indexArray = this.toUintTypedArray(idxArr);
          geom.setIndex(new THREE.BufferAttribute(indexArray, 1));
          geom.computeVertexNormals();

          // 调整几何在世界的位置与朝向
          finalizeCircleGeometryPosition(geom, this.planeNormal, circleCenter);

          const mat = new THREE.MeshStandardMaterial({
            color: 0x2196f3,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
          });

          const mesh = new THREE.Mesh(geom, mat);
          mesh.name = 'KernelCircleFace';
          scene.add(mesh);
          return;
        } else {
          console.warn('Mesher 未返回 position/index，回退到线框渲染');
        }
      } catch (e) {
        console.warn('Mesher 失败，回退到线框渲染:', e);
      }
    }

    // 回退：若没有 face 或 mesher 失败 -> 尝试绘制 topoWire/edge 线框
    try {
      // TODO: 这里需要你项目中将 topoWire/edge 转为 THREE.Line 的通用方法
      // 我在此提供一个占位的日志，实际项目中替换为你的线框渲染 pipeline
      console.log('回退到线框渲染（topoWire/edge）', { shape, topoWire });
      // e.g. this.manager.renderWireframeFromWasm(topoWire || shape, scene);
    } catch (e) {
      console.warn('线框渲染回退也失败:', e);
    }
  }

  private toUintTypedArray(src: number[] | ArrayBuffer | Uint8Array | Uint16Array | Uint32Array) {
    if (Array.isArray(src)) {
      // 根据最大值决定类型
      const max = src.reduce((m, v) => Math.max(m, v | 0), 0);
      return max > 65535 ? new Uint32Array(src) : new Uint16Array(src);
    } else if (src instanceof Uint32Array || src instanceof Uint16Array) {
      return src;
    } else if (src instanceof Uint8Array) {
      // 假设索引已按字节表示（不常见）
      return new Uint32Array(src);
    } else if (src instanceof ArrayBuffer) {
      // 尝试视为 Uint32Array
      return new Uint32Array(src);
    } else {
      // 最后回退：尝试把它当作 any[] 处理
      try {
        return new Uint32Array(Array.from(src as any));
      } catch {
        throw new Error('无法将索引数组转换为 TypedArray');
      }
    }
  }

}

// ----------------- 公共工具函数 -----------------

/**
 * 在生成 Mesh 之前统一处理网格位置与朝向。
 * 目标：
 *  - 如果 Mesher 已在世界坐标中（顶点中心不在原点，法向不等于 +Z） -> 仅做必要旋转/平移修正
 *  - 如果 Mesher 生成的是局部原点圆（center 接近 0，法向≈+Z） -> 将其基变换为期望 planeNormal 并平移到 circleCenter
 */
function finalizeCircleGeometryPosition(
  g: THREE.BufferGeometry,
  planeNormal: THREE.Vector3,
  circleCenter: THREE.Vector3
) {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  if (!pos || pos.count < 3) return;

  // 取前三个顶点估算法向
  const vA = new THREE.Vector3(pos.getX(0), pos.getY(0), pos.getZ(0));
  const vB = new THREE.Vector3(pos.getX(1), pos.getY(1), pos.getZ(1));
  const vC = new THREE.Vector3(pos.getX(2), pos.getY(2), pos.getZ(2));
  let estNormal = vB.clone().sub(vA).cross(vC.clone().sub(vA)).normalize();

  // 估算几何中心（使用所有点）
  const center = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    center.x += pos.getX(i);
    center.y += pos.getY(i);
    center.z += pos.getZ(i);
  }
  center.multiplyScalar(1 / pos.count);

  const desired = planeNormal.clone().normalize();

  // 判断是否局部原点圆（中心接近原点且法向接近 +Z）
  const isLocal = center.length() < 1e-6 && Math.abs(estNormal.dot(new THREE.Vector3(0, 0, 1)) - 1) < 1e-3;

  // 若法向朝向与期望相反，翻转索引（改变面顺序）
  if (estNormal.dot(desired) < 0) {
    const index = g.getIndex();
    if (index) {
      const arr = index.array as Uint32Array | Uint16Array;
      for (let i = 0; i + 2 < arr.length; i += 3) {
        const t = arr[i + 1];
        arr[i + 1] = arr[i + 2];
        arr[i + 2] = t;
      }
      index.needsUpdate = true;
      g.computeVertexNormals();
      estNormal = estNormal.clone().multiplyScalar(-1);
    }
  }

  if (isLocal) {
    // 构造局部正交基 (u, v, n) 并应用
    const n = desired;
    const ref = Math.abs(n.z) < 0.99 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(n, ref).normalize();
    const v = new THREE.Vector3().crossVectors(n, u).normalize();
    const basis = new THREE.Matrix4().makeBasis(u, v, n);
    basis.setPosition(circleCenter);
    g.applyMatrix4(basis);
    g.computeVertexNormals();
    return;
  } else {
    // 已在世界坐标，做最小旋转/平移对齐
    const angle = estNormal.angleTo(desired);
    if (angle > 1e-6) {
      const q = new THREE.Quaternion().setFromUnitVectors(estNormal, desired);
      const rotM = new THREE.Matrix4().makeRotationFromQuaternion(q);
      g.applyMatrix4(rotM);
    }
    // 平移中心对齐
    const afterPos = g.getAttribute('position') as THREE.BufferAttribute;
    const newCenter = new THREE.Vector3();
    for (let i = 0; i < afterPos.count; i++) {
      newCenter.x += afterPos.getX(i);
      newCenter.y += afterPos.getY(i);
      newCenter.z += afterPos.getZ(i);
    }
    newCenter.multiplyScalar(1 / afterPos.count);
    const delta = circleCenter.clone().sub(newCenter);
    if (delta.length() > 1e-6) {
      g.applyMatrix4(new THREE.Matrix4().makeTranslation(delta.x, delta.y, delta.z));
    }
    g.computeVertexNormals();
  }
}
