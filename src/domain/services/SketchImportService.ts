// src/domain/services/SketchImportService.ts
import { exportSketchJSON, importSketchJSON } from '../../core/managers/sketchManager/sketchSerialization';
import {SketchFactory} from '../factories/SketchFactory';

export class SketchImportService {
  constructor(private app: any, private manager: any) {}

  exportSketch(name: string, list: any[], items: any[], constraints: any[], plane: string) {
    const uniqueName = name;
    return exportSketchJSON(uniqueName, plane, items, constraints);
  }

  importFromJSON(data: any) {
    this.manager.sketchItems.value.length = 0;
    const items = importSketchJSON(data, SketchFactory, this.app.scene);
    this.manager.sketchItems.value.push(...items);
    this.manager.allSketchItems.push([...this.manager.sketchItems.value]);
    this.app.renderOnce();
  }
}
