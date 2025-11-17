// src/core/sketch/managers/SketchDataManager.ts
import * as THREE from 'three';
import { SketchConstraintManager } from './SketchConstraintManager';
import { getPlaneName } from '../../utils/sketchUtils';
import { SketchItem, RectItem } from '../../geometry/sketchs';
import {
  SketchUploadService,
  SketchImportService,
  SketchSyncService,
  SketchNameService
} from '../../../domain/services';


export class SketchDataManager {
  public sketchId = 0;
  public sketchName = '草图';
  private constraintManager = new SketchConstraintManager();
  private uploadService: SketchUploadService;
  private importService: SketchImportService;
  private syncService: SketchSyncService;
  private nameService: SketchNameService;

  constructor(
    private app: { scene: THREE.Scene; renderOnce: () => void },
    private manager: {
      sketchItems: { value: SketchItem[] };
      allSketchItems: SketchItem[][];
      sketchList: { value: any[] };
      sketchScene: { clearSketchObjectsFromScene: () => void };
      sketchSession: { currentSketchPlane: THREE.Plane | null };
    }
  ) {
    this.nameService = new SketchNameService();
    this.uploadService = new SketchUploadService(this.app, this.manager, this.nameService);
    this.importService = new SketchImportService(this.app, this.manager);
    this.syncService = new SketchSyncService(this.app, this.manager, this.importService);
  }

  /** 设置草图元数据 */
  setSketchMeta(id: number, name: string) {
    this.sketchId = id;
    this.sketchName = name;
  }

  /** 添加约束 */
  addConstraint(type: string, entities: number[]) {
    this.constraintManager.addConstraint(type, entities);
  }

  /** 导出当前草图 JSON 字符串 */
  exportJSON(): string {
    return this.importService.exportSketch(
      this.sketchName,
      this.manager.sketchList.value,
      this.manager.sketchItems.value,
      this.constraintManager.getConstraints(),
      this.currentPlaneName ?? 'XY'
    );
  }

  /** 上传当前草图 */
  async upload() {
    const json = this.exportJSON();
    return await this.uploadService.upload(json);
  }

  /** 加载所有草图 */
  async loadAll() {
    console.log('草图列表', this.manager.allSketchItems);
    return await this.syncService.loadAll();
    
  }

  /** 加载单个草图 */
  async loadById(id: number) {
    return await this.syncService.loadById(id);
  }

  /** 删除草图 */
  async deleteSketchByID(id: number) {
    return await this.syncService.deleteSketchByID(id);
  }

  /** 刷新草图列表 */
  async refreshSketchList() {
    return await this.syncService.refreshSketchList();
  }

  /** 当前绘制平面名称 */
  get currentPlaneName() {
    return this.manager.sketchSession.currentSketchPlane
      ? getPlaneName(this.manager.sketchSession.currentSketchPlane)
      : null;
  }
}
