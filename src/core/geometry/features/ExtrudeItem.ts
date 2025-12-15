// ExtrudeItem.ts
// 拉伸特征相关类型与实现

import { FeatureItem } from './FeatureItem';
import * as THREE from 'three';
import { RectExtrudeItem } from './RectExtrudeItem';
import { CircleExtrudeItem } from './CircleExtrudeItem';

export type ExtrudeItemType = 'rect' | 'circle'; // 拉伸类型：矩形或圆

/**
 * 拉伸特征基类，继承FeatureItem
 * @param type 拉伸类型
 * @param plane 所在平面（XY/XZ/YZ）
 */
export abstract class ExtrudeItem extends FeatureItem {
  constructor(type: ExtrudeItemType, plane: string = 'XY', id?: string, name?: string) {
    super(type, plane, id, name);
  }

  /**
   * 创建拉伸几何体（静态方法，供管理器或工厂调用）
   * 优先尝试使用 chili-wasm 返回的 TopoDS_Shape + Mesher 生成网格；失败则回退到 Three.js ExtrudeGeometry。
   * @param item ExtrudeItem实例
   * @param params 拉伸参数（支持传入 wasm 形状：params.wasmShape 或启用尝试：params.tryWasm）
   * @param plane 拉伸体所在平面
   * @param material THREE材质
   * @returns THREE.Mesh | null
   */
  static createExtrudeMesh(
    item: any,
    params: any = {},
    plane: string = 'XY',
    material?: THREE.Material
  ): THREE.Mesh | null {
    /**
     * ExtrudeItem静态方法被ExtrudeManager调用，实现拉伸体创建和预览的解耦与复用。
     */
    // 1) 若外部已提供 WASM 形状（TopoDS_Shape），直接用 Mesher 网格化
    const wasmMod: any = (globalThis as any).wasm;
    const deflection: number = params.deflection ?? 0.5;
    if (wasmMod?.Mesher && params?.wasmShape) {
      const mesh = this.meshFromWasmShape(params.wasmShape, deflection, material);
      if (mesh) {
        // 根据 plane 和 start/end 进行定位与对齐
        const start = params?.start ?? 0;
        const end = params?.end ?? 10;
        const depth = end - start;
        this.applyPlaneRotation(mesh.geometry, plane);
        mesh.geometry.translate(0, 0, Math.min(start, end));
        // 如果需要，将 mesh 置于草图坐标（这里保持与回退一致）
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
      }
    }

    // 2) 可选：尝试使用 chili-wasm 内部构造拉伸体（如果工程中提供对应工厂方法）
    // 说明：以下调用带有特性探测，只有当你的 wasm 导出包含相应 API 才会执行；
    // 若没有导出（多数情况下），会自动回退到 Three.js 方案。
    if (wasmMod && params?.tryWasm) {
      try {
        const maybe = this.tryBuildWasmExtrude(item, params, plane, wasmMod);
        if (maybe) {
          const mesh = this.meshFromWasmShape(maybe, deflection, material);
          if (mesh) {
            const start = params?.start ?? 0;
            const end = params?.end ?? 10;
            this.applyPlaneRotation(mesh.geometry, plane);
            mesh.geometry.translate(0, 0, Math.min(start, end));
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            return mesh;
          }
        }
      } catch (err) {
        console.warn('尝试使用 chili-wasm 构造拉伸体失败，回退到 Three.js：', err);
      }
    }

    // 3) 回退：Three.js ExtrudeGeometry
    let shape: THREE.Shape | null = null;
    const start = params?.start ?? 0;
    const end = params?.end ?? 10;
    const depth = end - start;
    if (depth === 0) return null;

    switch (item.type) {
      case 'rect': {
        const rect = item as RectExtrudeItem;
        if (!rect.p1 || !rect.p2) return null;
        const [x1, , z1] = rect.p1;
        const [x2, , z2] = rect.p2;
        shape = new THREE.Shape();
        shape.moveTo(x1, z1);
        shape.lineTo(x2, z1);
        shape.lineTo(x2, z2);
        shape.lineTo(x1, z2);
        shape.lineTo(x1, z1);
        break;
      }
      case 'circle': {
        const circle = item as CircleExtrudeItem;
        if (!circle.p1) return null;
        const [cx, , cz] = circle.p1;
        shape = new THREE.Shape();
        shape.absarc(cx, cz, circle.radius, 0, Math.PI * 2, false);
        break;
      }
      default:
        return null;
    }
    if (!shape) return null;

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: Math.abs(depth),
      bevelEnabled: false,
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    ExtrudeItem.applyPlaneRotation(geometry, plane);
    geometry.translate(0, 0, Math.min(start, end));
    const mesh = new THREE.Mesh(geometry, material ?? new THREE.MeshStandardMaterial({ color: 0x88ccff }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * 使用 chili-wasm 的 Mesher 将 TopoDS_Shape 转为 Three.js Mesh
   * 说明：不同版本的 Mesher 可能以属性或方法暴露数据，这里做了健壮访问。
   */
  private static meshFromWasmShape(shape: any, deflection = 0.5, material?: THREE.Material): THREE.Mesh | null {
    const wasmMod: any = (globalThis as any).wasm;
    if (!wasmMod?.Mesher) return null;

    const mesher = new wasmMod.Mesher(shape, deflection);
    // 兼容属性/方法两种暴露方式
    const positions: Float32Array | undefined =
      (mesher.positions as Float32Array) ||
      (typeof mesher.getPositions === 'function' ? mesher.getPositions() : undefined);
    const indices: Uint32Array | Uint16Array | undefined =
      (mesher.indices as Uint32Array | Uint16Array) ||
      (typeof mesher.getIndices === 'function' ? mesher.getIndices() : undefined);
    const normals: Float32Array | undefined =
      (mesher.normals as Float32Array) ||
      (typeof mesher.getNormals === 'function' ? mesher.getNormals() : undefined);

    if (!positions || positions.length === 0) {
      console.error('Mesher 未返回 positions');
      return null;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (normals && normals.length) {
      geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    } else {
      geom.computeVertexNormals();
    }
    if (indices && indices.length) {
      // 类型兼容处理：Uint16Array / Uint32Array
      geom.setIndex(new THREE.BufferAttribute(indices as any, 1));
    }

    const mat = material ?? new THREE.MeshStandardMaterial({ color: 0x88ccff, side: THREE.DoubleSide });
    return new THREE.Mesh(geom, mat);
  }

  /**
   * 尝试用 chili-wasm 构造拉伸体（特性探测，不同版本导出的 API 名称可能不同）
   * 返回 TopoDS_Shape 或 undefined
   */
  private static tryBuildWasmExtrude(item: ExtrudeItem, params: any, plane: string, wasmMod: any): any | undefined {
    // 将 XY/XZ/YZ 平面映射为法线方向
    const planeNormal = (() => {
      switch (plane.toUpperCase()) {
        case 'XZ': return { x: 0, y: 1, z: 0 };
        case 'YZ': return { x: 1, y: 0, z: 0 };
        default:   return { x: 0, y: 0, z: 1 }; // XY
      }
    })();

    const start = params?.start ?? 0;
    const end = params?.end ?? 10;
    const depth = end - start;
    if (depth === 0) return;

    // 圆：优先使用 ShapeFactory.circle（若存在），再尝试 prism/extrude
    if (item.type === 'circle' && wasmMod.ShapeFactory?.circle) {
      const c = item as any as CircleExtrudeItem;
      if (!c.p1) return;
      const [cx, , cz] = c.p1;
      const center = { x: cx, y: 0, z: cz }; // 草图内 y 轴对应到三维 y=0 平面
      const direction = planeNormal;
      const edgeOrWire = wasmMod.ShapeFactory.circle(direction, center, c.radius);
      // 候选挤出 API 名称（不同版本可能不同）
      const extruders = [
        'extrude', 'prism', 'extrudePrism', 'makePrism', 'extrudeFace', 'sweep'
      ];
      for (const fn of extruders) {
        if (typeof wasmMod.ShapeFactory?.[fn] === 'function') {
          try {
            return wasmMod.ShapeFactory[fn](edgeOrWire, { x: direction.x * depth, y: direction.y * depth, z: direction.z * depth });
          } catch { /* 尝试下一个 */ }
        }
      }
      // 次优：若能从圆生成面（Wire.makeFace），再尝试挤出面
      if (wasmMod.Wire?.makeFace) {
        try {
          const face = wasmMod.Wire.makeFace(edgeOrWire);
          for (const fn of extruders) {
            if (typeof wasmMod.ShapeFactory?.[fn] === 'function') {
              try {
                return wasmMod.ShapeFactory[fn](face, { x: direction.x * depth, y: direction.y * depth, z: direction.z * depth });
              } catch { /* 尝试下一个 */ }
            }
          }
        } catch { /* 忽略 */ }
      }
      return;
    }

    // 矩形：若提供 box API，可以快速替代矩形拉伸
    if (item.type === 'rect' && wasmMod.ShapeFactory?.box) {
      const r = item as any as RectExtrudeItem;
      if (!r.p1 || !r.p2) return;
      const [x1, , z1] = r.p1;
      const [x2, , z2] = r.p2;
      const w = Math.abs(x2 - x1);
      const h = Math.abs(z2 - z1);
      const d = Math.abs(depth);
      const box = wasmMod.ShapeFactory.box(w, d, h); // 宽、深、 高（根据你的实现调整参数顺序）
      // 平移到矩形区域中心
      const cx = (x1 + x2) / 2;
      const cz = (z1 + z2) / 2;
      const translate = wasmMod.ShapeFactory?.translate;
      if (typeof translate === 'function') {
        try {
          return translate(box, { x: cx, y: Math.min(start, end) + d / 2, z: cz });
        } catch { /* 如果没有 translate，直接返回 box 原点 */ }
      }
      return box;
    }

    return;
  }

  /**
   * 平面旋转工具（静态方法）
   */
  static applyPlaneRotation(geometry: THREE.BufferGeometry, plane: string) {
    switch (plane.toUpperCase()) {
      case 'XZ':
        geometry.rotateX(-Math.PI / 2);
        break;
      case 'YZ':
        geometry.rotateY(Math.PI / 2);
        break;
      default:
        break;
    }
  }
}
