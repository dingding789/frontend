// src/core/sketch/services/SketchSyncService.ts
import { listSketches, loadSketch, deleteSketch } from '../../infrastructure/api/sketchApi';
import { toRaw } from 'vue';
import { SketchImportService } from './SketchImportService';

export class SketchSyncService {
  constructor(private app: any, private manager: any, private importService: SketchImportService) {}

  async loadAll() {
    const res = await listSketches();
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message);

    this.manager.sketchList.value = data.sketches.map((it: any) => ({ id: it.id, name: it.name || `草图 ${it.id}` }));
    this.manager.allSketchItems.length = 0;

    for (const sketch of data.sketches) {
      try { this.importService.importFromJSON(sketch); }
      catch (err) { console.error('导入草图失败', sketch.id, err); }
    }
    this.app.renderOnce();
  }

  async loadById(id: number) {
    const res = await loadSketch(id);
    const data = await res.json();
    this.importService.importFromJSON(data);
  }

  async deleteSketchByID(id: number) {
    const res = await deleteSketch(id);
    const result = await res.json();
    console.log('删除结果:', result);

    this.manager.allSketchItems.forEach(items => items.forEach(item => toRaw(item).remove(this.app.scene)));
    this.manager.allSketchItems.length = 0;

    await this.loadAll();
  }

  async refreshSketchList() {
    const res = await listSketches();
    const data = await res.json();
    this.manager.sketchList.value = (data.sketches || []).map((it: any) => ({ id: it.id, name: it.name }));
  }
}

