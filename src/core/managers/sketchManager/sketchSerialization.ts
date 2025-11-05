// 草图序列化/反序列化工具
import { SketchJSON } from '../../../domain/models/SketchModel';
import { SketchItem } from '../../geometry/sketchs';

export function exportSketchJSON(name: string, plane: string, items: SketchItem[], constraints: any[]): string {
  const sketch: SketchJSON = {
    type: 'Sketch',
    name,
    plane,
    origin: [0, 0, 0],
    items: items.map(item => item.toJSON?.()).filter(Boolean),
    constraints,
  };
  return JSON.stringify(sketch, null, 2);
}

export function importSketchJSON(data: SketchJSON, factory: any, scene: any): SketchItem[] {
  const result: SketchItem[] = [];
  for (const itemData of data.items || []) {
    const obj = factory.fromJSON(itemData);
    if (obj) {
      obj.draw(scene);
      result.push(obj);
    }
  }
  return result;
}
