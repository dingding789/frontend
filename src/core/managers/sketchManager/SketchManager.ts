// SketchManager.ts
// 草图管理器，负责整个草图绘制流程的调度与管理，包括场景、数据、会话、平面操作等。
import * as THREE from 'three';
import { ref } from 'vue';
import AppManager from '../../scene/AppManager';
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

/**
 * SketchManager
 * 负责管理整个草图绘制流程，包括：
 * - 草图场景管理
 * - 草图数据管理
 * - 草图会话状态管理
 * - 平面操作与预览
 */
export default class SketchManager {
  private app: AppManager; // 主应用管理器实例

  // ---------------- 各模块管理器 ----------------
  public sketchScene: SketchSceneManager;   // 管理 THREE.js 场景中的草图对象
  public sketchData: SketchDataManager;     // 管理草图数据上传和列表刷新
  public sketchSession: SketchSessionManager; // 管理绘图状态（是否绘制中、当前平面、当前工具）
  private planeMgr: SketchPlaneManager;     // 管理绘图平面和点击选择逻辑
  private highlightMgr: HighlightManager;   // 平面高亮管理

  // ---------------- 草图元素数据 ----------------
  public allSketchItems: SketchItem[][] = []; // 所有历史草图元素（可用于撤销/重做等）
  public sketchItems = ref<SketchItem[]>([]);    // 当前正在绘制的草图元素
  public sketchList = ref<{ id: number; name: string }[]>([]); // 草图列表（id + 名称）

  private previewItem: SketchItem | null = null; // 临时预览线段或对象
  private preSketchPos = new THREE.Vector3();    // 保存开始绘图前相机位置
  private preSketchUp = new THREE.Vector3();     // 保存开始绘图前相机上方向
  private circleCreatorCtl?: AbortController; // 新增
 
 

  constructor(app: AppManager) {
    this.app = app;
    // 初始化各管理器实例
    this.planeMgr = new SketchPlaneManager(app);
    this.sketchScene = new SketchSceneManager(app, this);
    this.sketchData = new SketchDataManager(app, this);
    this.sketchSession = new SketchSessionManager(app, this);
    this.highlightMgr = new HighlightManager(app, this);
  }



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
    this.sketchSession.isSketching.value = true;

    // 清空旧草图数据并从场景中移除
    //this.sketchItems.forEach(i => i.remove(this.app.scene));
    this.sketchItems.value.length = 0;
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
   * - 设置绘图状态为 inactive
   * - 上传草图数据（可选）
   * - 删除预览对象
   * - 移除草图平面
   * - 恢复相机位置和方向
   * - 恢复轨道控制器
   * - 刷新草图列表
   * - 渲染场景
   *
   * @param save 是否保存草图数据
   */
  async finishSketch(save = true) {
    // 1. 结束绘图状态
    this.sketchSession.isSketching.value = false;

    // 2. 上传草图数据（如有需要）
    if (save && this.sketchItems.value.length > 0) {
      try {
        await this.sketchData.upload();
      } catch (err: any) {
        console.error('上传草图失败:', err);
        // 直接弹出错误，便于你看到后端返回的具体提示
        if (typeof window !== 'undefined') {
          window.alert?.(`上传草图失败: ${err?.message ?? err}`);
        }
      }
    }

    // 3. 删除预览线段或对象
    this.previewItem?.remove(this.app.scene);
    this.previewItem = null;

    // 4. 移除绘图平面
    this.planeMgr.removeAll();
    this.sketchSession.currentSketchPlane = null;

    // 5. 恢复相机位置和方向
    this.app.camera.position.copy(this.preSketchPos);
    this.app.camera.up.copy(this.preSketchUp);
    this.app.camera.lookAt(0, 0, 0);
    this.app.controls.instance.enabled = true;

    console.log('已完成草图绘制，保留场景元素');

    // 6. 上传完成后刷新草图列表
    await this.sketchData.refreshSketchList();

    // 7. 先写入历史，再更新高亮，保证 ExtrudeManager 能在 allSketchItems 中拾取到最新草图
    this.allSketchItems.push([...this.sketchItems.value]);
    this.highlightMgr.setItems([...this.allSketchItems.flat()]);

    // // === 新增：将封闭草图自动转为面（供后续拉伸使用） ===
    // const planeNormal: THREE.Vector3 =
    //   (((this.sketchSession.currentSketchPlane as any)?.normal) as THREE.Vector3) ?? new THREE.Vector3(0, 0, 1);
    // const faces = buildFacesFromSketchItems(this.sketchItems.value, planeNormal);
    // for (const f of faces) f.draw(this.app.scene);

    // 解绑事件，清理预览
    this.circleCreatorCtl?.abort();
    this.circleCreatorCtl = undefined;

    this.app.renderOnce();

  }


    private pickPoint(ev: MouseEvent): THREE.Vector3 {
    const rect = this.app.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.app.camera);

    // 优先使用当前草图平面的法向，假设平面过原点或有 plane 对象
    let plane: THREE.Plane; // 始终保证有值，避免 null
    const cur = this.sketchSession.currentSketchPlane as any;
    if (cur?.plane instanceof THREE.Plane) {
      plane = cur.plane;
    } else if (cur?.normal instanceof THREE.Vector3 && cur?.point instanceof THREE.Vector3) {
      plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cur.normal, cur.point);
    } else if (cur?.normal instanceof THREE.Vector3) {
      plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cur.normal, new THREE.Vector3());
    } else {
      // 默认 XY 平面 z=0
      plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    }

    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) {
      return hit;
    }
    return new THREE.Vector3(); // 未命中返回原点
  }
  
}


