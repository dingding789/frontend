// 草图序列化/反序列化工具
import { SketchJSON } from '../../../domain/models/SketchModel';
import { SketchItem } from '../../geometry/sketchs';
import * as THREE from 'three';
import { SketchStruct } from './SketchManager';

export function exportSketchJSON(name: string, sketch: SketchStruct, constraints: any[]): string {
  const sketchJson: SketchJSON = {
    type: 'Sketch',
    frontend_id: sketch.frontend_id,
    name,
    planeNormal: sketch.planeNormal,
    planeOrigin: sketch.planeOrigin,
    items: sketch.items.map(item => item.toJSON?.()).filter(Boolean),
    constraints,
  };
  
  // // 如果草图有 id，包含在 JSON 中（用于后端识别是更新还是创建）
  // if (sketch.id != null && sketch.id !== undefined) {
  //   sketchJson.id = sketch.id;
  //   console.log('导出草图(更新模式),ID:', sketch.id);
  // } else {
  //   console.log('导出草图（新建模式）');
  // }
  
  return JSON.stringify(sketchJson, null, 2);
}

export function importSketchJSON(data: SketchJSON, factory: any, scene: any): SketchStruct {
  const result: SketchStruct = {} as SketchStruct;
  result.name = data.name;
  result.planeNormal = data.planeNormal;
  result.planeOrigin = data.planeOrigin;
  result.items = [];
  for (const itemData of data.items || []) {
    const obj = factory.fromJSON(itemData);
    if (obj) {
      obj.draw(scene);
      result.items.push(obj);
    }
  }
  return result;
}
