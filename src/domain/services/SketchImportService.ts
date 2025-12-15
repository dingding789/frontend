// src/domain/services/SketchImportService.ts
import { exportSketchJSON } from '../../core/managers/sketchManager/sketchSerialization';
import {SketchFactory} from '../factories/SketchFactory';
import * as THREE from 'three';
import { SketchManager, SketchStruct } from '../../core/managers/sketchManager/SketchManager';
import AppManager from '../../core/AppManager';
import { SketchJSON } from '../models/SketchModel';
export class SketchImportService {
  constructor(private app: AppManager, private manager: SketchManager) {}

  exportSketch(name: string, sketch: SketchStruct, constraints: any[]) {
    const uniqueName = name;
    return exportSketchJSON(uniqueName, sketch, constraints);
  }

  importFromJSON(data: SketchJSON) {
    this.manager.sketch = {
      id: data.id,
      frontend_id: data.frontend_id,
      name: data.name,
      type: "sketch",
      planeNormal: data.planeNormal,
      planeOrigin: data.planeOrigin,
      items: [],
      createdAt: data.created_at,
      constraints: data.constraints || [],
    };
    for (const itemData of data.items || []) {
      const obj = SketchFactory.fromJSON(itemData);
      if (obj) {
        obj.draw(this.app.scene);
        this.manager.sketch.items.push(obj);
      }
    }
    this.manager.allSketch.push(this.manager.sketch);
    this.app.renderOnce();
  }
}
