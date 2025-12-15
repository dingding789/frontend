// SketchManager.ts
// 草图管理器，负责整个草图绘制流程的调度与管理，包括场景、数据、会话、平面操作等。
import * as THREE from 'three';
import { ref } from 'vue';
import AppManager from '../../AppManager';
import { SketchItem } from '../../geometry/sketchs';
import {
  SketchPlaneManager,
  SketchSceneManager,
  SketchDataManager,
  SketchSessionManager,
  HighlightManager
} from './index';

// ---------------- 工具 & 类型 ----------------
export type SketchTool = 'point' | 'line' | 'arc' | 'rect' | 'circle' | 'spline'; // 草图工具类型，新增circle
export type SketchPlaneName = 'XY' | 'YZ' | 'XZ'; // 草图平面名称


/** 草图结构体类型 */
export interface SketchStruct {
  id?: number;
  frontend_id: string; // 前端生成的唯一 ID
  name: string; // 草图名称
  type: "sketch";
  planeNormal: THREE.Vector3; // 草图平面法向
  planeOrigin: THREE.Vector3; // 草图平面原点
  items: SketchItem[]; // 草图包含的元素
  createdAt: Date; // 创建时间
  updatedAt?: Date; // 更新时间（可选）
  constraints: any[]; // 草图约束列表

}


/**
 * SketchManager
 * 负责管理整个草图绘制流程，包括：
 * - 草图场景管理
 * - 草图数据管理
 * - 草图会话状态管理
 * - 平面操作与预览
 */
export class SketchManager {
  public app: AppManager; // 主应用管理器实例

  // ---------------- 各模块管理器 ----------------
  public sketchScene: SketchSceneManager;   // 管理 THREE.js 场景中的草图对象
  public sketchData: SketchDataManager;     // 管理草图数据上传和列表刷新
  public sketchSession: SketchSessionManager; // 管理绘图状态（是否绘制中、当前平面、当前工具）
  public planeMgr: SketchPlaneManager;     // 管理绘图平面和点击选择逻辑
  private highlightMgr: HighlightManager;   // 平面高亮管理

  // ---------------- 草图元素数据 ----------------
  public allSketch: SketchStruct[] = []; // 所有历史草图元素（可用于撤销/重做等）
  public sketch!: SketchStruct; // 当前正在绘制的草图数据结构
  public sketchList = ref<{ id: number; name: string }[]>([]); // 草图列表（id + 名称）

  public previewItem: SketchItem | null = null; // 临时预览线段或对象
  private preSketchPos = new THREE.Vector3();    // 保存开始绘图前相机位置
  private preSketchUp = new THREE.Vector3();     // 保存开始绘图前相机上方向




  constructor(app: AppManager) {
    this.app = app;
    // 初始化各管理器实例
    this.planeMgr = new SketchPlaneManager(app);
    this.sketchScene = new SketchSceneManager(app, this);
    this.sketchData = new SketchDataManager(app, this);
    this.sketchSession = new SketchSessionManager(app, this);
    this.highlightMgr = new HighlightManager(app);
  }

  // ---------------- 基本控制方法 ----------------

  /**
   * startSketch
   * 开始绘制草图：
   * - 设置绘图状态为 active
   * - 清空当前草图元素并从场景中移除
   * - 保存相机位置和方向
   * - 禁用轨道控制器
   * - 创建草图平面并启用点击选择
   * - 渲染一次场景
   */
  startSketch() {
    this.sketch = {
      frontend_id: '',
      type: "sketch",
      name: '草图',
      planeNormal: new THREE.Vector3(0, 0, 0),
      planeOrigin: new THREE.Vector3(0, 0, 0),
      items: [],
      createdAt: new Date(),
      constraints: [],
    };
    this.sketchSession.isSketching.value = true;
    
    this.previewItem?.remove(this.app.scene);

    // 保存当前相机状态
    this.preSketchPos.copy(this.app.camera.position);
    this.preSketchUp.copy(this.app.camera.up);

    // 禁用轨道控制器并显示绘图平面
    this.planeMgr.createPlanes();

    if (typeof this.planeMgr.enableClickSelect === 'function') {
      this.planeMgr.enableClickSelect();
    }
    this.app.renderOnce();


  }

  /**
   * finishSketch
   * 完成草图绘制：
   * - 判断是编辑模式还是新建模式
   * - 编辑模式：保存到双击点击的草图ID
   * - 新建模式：创建新草图
   * - 设置绘图状态为 inactive
   * - 上传草图数据（可选）
   * - 删除预览对象
   * - 移除草图平面
   * - 恢复相机位置和方向
   * - 恢复轨道控制器
   * - 刷新草图列表（仅新建时）
   * - 渲染场景
   *
   * @param save 是否保存草图数据
   */
  async finishSketch(save = true) {
    // 优先检查编辑管理器是否处于编辑模式
    const sketchEditManager = (this as any).sketchEditManager;
    const isEditingFromManager = sketchEditManager && 
      typeof sketchEditManager.getIsEditingMode === 'function' &&
      sketchEditManager.getIsEditingMode();
    
    // 判断是编辑模式还是新建模式
    const isEditingMode = isEditingFromManager || (this.sketch && this.sketch.id != null);
    
    if (isEditingMode) {
      // 编辑模式：使用编辑管理器保存到对应的草图ID
      if (sketchEditManager && typeof sketchEditManager.finishAndSaveEditSession === 'function') {
        //console.log('检测到编辑模式，使用编辑管理器保存');
        await sketchEditManager.finishAndSaveEditSession();
        return;
      } else {
        //console.warn('编辑模式下未找到sketchEditManager,使用默认保存逻辑');
      }
    }

    // 新建模式：原有的逻辑
    this.sketch.frontend_id = `${Date.now()}`;
    this.sketch.createdAt = new Date();
    const hasItems = Array.isArray(this.sketch.items) && this.sketch.items.length > 0;

    if (save && hasItems) {
      try {
        // 传递名称以便上传服务做去重，并在成功后回填 id
        this.sketchData.sketchName = this.sketch.name || '草图';
        await this.sketchData.upload();
      } catch (err) {
        console.error('新建草图上传失败:', err);
      }
    } else if (save && !hasItems) {
      // 避免空草图被上传
      //console.log('未绘制任何元素，跳过草图上传');
    }

    // 结束绘图状态
    this.sketchSession.isSketching.value = false;

    // 删除预览对象
    this.previewItem?.remove(this.app.scene);
    this.previewItem = null;

    // 移除绘图平面
    this.planeMgr.removeAll();
    this.sketchSession.currentSketchPlane = null;

    // 恢复相机位置和方向
    this.app.camera.position.copy(this.preSketchPos);
    this.app.camera.up.copy(this.preSketchUp);
    this.app.camera.lookAt(0, 0, 0);
    this.app.controls.instance.enabled = true;

    this.app.renderOnce();
  }
  
}


