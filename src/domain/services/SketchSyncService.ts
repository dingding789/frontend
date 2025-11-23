// src/core/sketch/services/SketchSyncService.ts
import { listSketches, loadSketch, deleteSketch } from '../../infrastructure/api/sketchApi';
import { toRaw } from 'vue';
import { SketchImportService } from './SketchImportService';
import { SketchStruct } from '../../core/managers/sketchManager';
export class SketchSyncService {
  constructor(private app: any, public manager: any, private importService: SketchImportService) {}

  async loadAll() {
    const res = await listSketches();
    
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message);

    this.manager.sketchList.value = data.sketches.map((it: any) => ({ id: it.id, name: it.name || `草图 ${it.id}` }));
    this.manager.allSketch.length = 0;

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
    this.manager.allSketch.forEach(sketch => {
      sketch.items.forEach(item => {
        if (item && typeof item.remove === 'function') {
          item.remove(this.app.scene);
        } else {
          console.warn('item 无 remove 方法:', item);
        }
      });
    });
    console.log('删除草图结果:', this.manager.allSketch);
    this.manager.allSketch.length = 0;
    // 刷新草图列表
    await this.loadAll();
  }

  async refreshSketchList() {
    const res = await listSketches();
    const data = await res.json();
    this.manager.sketchList.value = (data.sketches || []).map((it: any) => ({ id: it.id, name: it.name }));
  }
}

