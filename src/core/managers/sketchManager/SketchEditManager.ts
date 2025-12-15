import AppManager from '../../AppManager';
import * as THREE from 'three';
import { SketchManager, SketchStruct } from './SketchManager';
import { SketchHideManager } from './SketchHide';

/**
 * 草图历史项结构，包含草图元素、平面、id、name
 */
export type SketchHistoryItem = {
  items: any[]; 
  plane: string;
  id: number;
  name: string;
};

/**
 * SketchEditManager
 * 用于切换到草图编辑界面，并加载指定草图内容（包括平面信息）
 */

export class SketchEditManager {

  private app: AppManager;
  private sketchManager: SketchManager;
  // 保存双击进入编辑前的相机位置（用于回滚时恢复）
  private preEditCameraPosition = new THREE.Vector3();
  private preEditCameraTarget = new THREE.Vector3();
  private preEditCameraUp = new THREE.Vector3();
  private hasPreEditCameraState = false; // 标记是否已保存相机状态
  private isEditingMode = false; // 标记是否处于编辑模式
  private currentEditingSketchId: number | null = null; // 记录当前编辑的草图ID

  constructor(app: AppManager, sketchManager: SketchManager) {
    this.app = app;
    this.sketchManager = sketchManager;
  }

  /** 查找草图分组
   * 在allsketch中查找草图对象
  */
  private findSketchGroupById(id: string) {
    const groups = this.sketchManager.allSketch || [];
    return groups.find((group: SketchStruct) =>
      String(group?.id) === id ||
      String(group?.items?.[0]?.id) === id ||
      String(group?.items?.[0]?.object3D?.userData?.sketchItem?.id) === id
    );
  }

  /** 任意格式转换为 three.Vector3 */
  private toVector3(raw: any): THREE.Vector3 | null {
    if (!raw) return null;
    if (raw instanceof THREE.Vector3) return raw.clone();
    if (Array.isArray(raw) && raw.length === 3) return new THREE.Vector3(raw[0], raw[1], raw[2]);
    if (typeof raw === 'object' && 'x' in raw && 'y' in raw && 'z' in raw) {
      return new THREE.Vector3(raw.x, raw.y, raw.z);
    }
    return null;
  }

  /** 根据原始标识或法向量判定平面名称 */
  private determinePlaneName(src: any): string {
    if (typeof src === 'string') {
      const planeStrUpper = src.toUpperCase();
      if (planeStrUpper === 'XY' || planeStrUpper === 'YZ' || planeStrUpper === 'XZ') return planeStrUpper;
    }
    const vector = this.toVector3(src);
    if (vector) {
      const normalized = vector.clone().normalize();
      const absX = Math.abs(normalized.x);
      const absY = Math.abs(normalized.y);
      const absZ = Math.abs(normalized.z);
      if (absZ >= absX && absZ >= absY) return 'XY';
      if (absX >= absY && absX >= absZ) return 'YZ';
      if (absY >= absX && absY >= absZ) return 'XZ';
    }
    return 'XY';
  }

  /** 解析草图的法向量（可能来自 planeNormal / plane / userData） */
  //raw为原始值
  private extractPlaneNormal(group: any): THREE.Vector3 {
    let raw =
      group?.planeNormal ||
      group?.items?.find((it: any) => it?.planeNormal)?.planeNormal ||
      group?.items?.[0]?.object3D?.userData?.sketchItem?.planeNormal;

    if (!raw) {
      const dir =
        group?.plane ||
        group?.items?.[0]?.plane ||
        group?.items?.[0]?.object3D?.userData?.sketchItem?.plane;
    }

    let vec: THREE.Vector3 | null = this.toVector3(raw);
    if (!vec) vec = new THREE.Vector3(0, 0, 1);
    return vec.normalize();
  }

  /** 对外：根据草图ID获取平面法向量 */
  getPlaneNormalBySketchId(sketchId: number | string): THREE.Vector3 | null {
    const group = this.findSketchGroupById(String(sketchId));
    if (!group) {
      console.warn(`草图ID ${sketchId} 未找到(allSketch)`);
      return null;
    }
    return this.extractPlaneNormal(group);
  }

  /** 保存当前相机位置（在双击进入编辑前调用） */
  saveCameraState(): void {
    this.preEditCameraPosition.copy(this.app.camera.position);
    this.preEditCameraUp.copy(this.app.camera.up);

    this.hasPreEditCameraState = true;
    // console.log('已保存相机位置:', {
    //   position: this.preEditCameraPosition.toArray(),
    //   target: this.preEditCameraTarget.toArray(),
    //   up: this.preEditCameraUp.toArray()
    // });
  }

  /** 恢复保存的相机位置（回滚编辑时调用） */
  restoreCameraState(): void {
    if (!this.hasPreEditCameraState) {
      console.warn('没有保存的相机状态，无法恢复');
      return;
    }

    // 恢复相机位置和方向
    this.app.camera.position.copy(this.preEditCameraPosition);
    this.app.camera.up.copy(this.preEditCameraUp);
    
    // 恢复 controls 的 target
    const controls = this.app.controls.instance;
    if (controls && typeof controls.target !== 'undefined') {
      controls.target.copy(this.preEditCameraTarget);
      controls.update?.();
    }
    
    // 让相机朝向 target
    this.app.camera.lookAt(this.preEditCameraTarget);
    
    //console.log('已恢复相机位置到双击前的状态');
    this.app.renderOnce();
  }

  /** 聚焦摄像机到草图平面（加入隐藏其它草图逻辑，且不显示基准平面）
   * @param isRollback 是否为回滚操作，如果是则恢复相机位置
   */
  focusCameraToSketchPlane(sketchId: number | string, isRollback: boolean = false): boolean {
    // 如果是回滚操作，先恢复相机位置
    if (isRollback) {
      this.restoreCameraState();
    }

    // 1) 查找当前草图分组
    const group = this.findSketchGroupById(String(sketchId));
    if (!group) {
      console.warn(`草图ID ${sketchId} 未找到 allSketch`);
      return false;
    }
    // 2) 隐藏其它草图（使用 SketchHideManager）
      const hideManager = new SketchHideManager(this.sketchManager);
      console.log('回滚编辑草图ID=', String(sketchId));
      hideManager.hideExcept(sketchId);
      
    // 3) 平面名称来自已有数据（保持与其他草图一致）
    const normal = this.extractPlaneNormal(group);
    const planeName = this.determinePlaneName(
      typeof (group as any).plane === 'string' ? (group as any).plane : normal
    );
    //4) 直接使用 SketchPlaneManager 的选择逻辑，不自行设置摄像机
    const planeManager = this.sketchManager.planeMgr;
    if (!planeManager) {
      console.warn('planeMgr不存在,无法选择平面');
      return false;
    }
   // thrPlane为一个数学平面
    const thrPlane = planeManager.selectPlane(planeName);
    if (!thrPlane) {
      console.warn('返回空 planeName=', planeName);
      return false;
    }
    //5) 设置当前会话绘图平面，不修改摄像机位置（回滚时已恢复）
    if (this.sketchManager.sketchSession) {
      this.sketchManager.sketchSession.currentSketchPlane = thrPlane;
      this.sketchManager.sketchSession.isSketching.value = true;
    }
    this.app.renderOnce();
    return true;
  }

  public startEditSession(sketchId: number | string, opts?: { clearOld?: boolean }): boolean {
    const session = this.sketchManager.sketchSession;
      if (session) {
        session.isSketching.value = true;
      }
      const group = this.findSketchGroupById(String(sketchId));
      if (group && group.id != null) {
        this.sketchManager.sketch = group;
        this.isEditingMode = true; // 设置编辑模式标志
        this.currentEditingSketchId = group.id; // 保存编辑的ID
        
        // 同步当前绘制平面（使用已有平面信息）
        const planeNormal = this.extractPlaneNormal(group);
        const planeOrigin = this.toVector3((group as any).planeOrigin) || new THREE.Vector3(0, 0, 0);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, planeOrigin);
        if (this.sketchManager.sketchSession) {
          this.sketchManager.sketchSession.currentSketchPlane = plane;        
        }
        return true;
      }
    return false;
  }
  public async finishAndSaveEditSession(): Promise<void> {
    const session = this.sketchManager.sketchSession;
    let currentSketch = this.sketchManager.sketch;

    // 修复：使用编辑模式标志和保存的ID，即使sketch.id丢失也能识别编辑模式
    if (!this.isEditingMode || !this.currentEditingSketchId) {
      // 不是编辑模式，走新建逻辑
      if (!currentSketch) {
        this.sketchManager.sketch = { id: null, name: '未命名草图', items: [], plane: 'XY' } as any;
        currentSketch = this.sketchManager.sketch;
      }
      await this.sketchManager.finishSketch(true);
      return;
    }

    // 编辑模式：确保当前草图有正确的ID
    const editingId = this.currentEditingSketchId;
    if (!currentSketch) {
      // 如果草图丢失，尝试从allSketch中恢复
      const group = this.findSketchGroupById(String(editingId));
      if (group) {
        this.sketchManager.sketch = group;
        currentSketch = group;
      } else {
        //console.warn('编辑模式下无法找到草图,ID:', editingId);
        this.isEditingMode = false;
        this.currentEditingSketchId = null;
        return;
      }
    }

    const hasItems = Array.isArray(currentSketch.items) && currentSketch.items.length > 0;

    if (hasItems) {
      try {
        currentSketch.updatedAt = new Date();
        const index = this.sketchManager.allSketch.findIndex(
          (s: SketchStruct) => s.id === editingId
        );
        if (index !== -1) {
          this.sketchManager.allSketch[index] = { ...currentSketch };
        } else {
          console.warn('在allSketch中未找到草图,ID:', editingId);
          this.sketchManager.allSketch.push({ ...currentSketch });
        }

        this.sketchManager.sketchData.setSketchMeta(
          editingId as number,
          currentSketch.name || '草图'
        );

        this.sketchManager.sketch.id = editingId;
        await this.sketchManager.sketchData.upload();
      } catch (error) {
        console.error('保存草图到后端失败:', error);
      }
    } else {
      // 即使没有新内容，也要清理编辑状态
     // console.log('编辑模式下没有新内容，仅清理状态');
    }
   
    // 清理编辑状态
    this.cleanupEditSession();
    this.isEditingMode = false;
    this.currentEditingSketchId = null;

    console.log('完成后打印草图列表', this.sketchManager.allSketch);
  }

  private cleanupEditSession(): void {
    const session = this.sketchManager.sketchSession;
    if (session) {
      session.isSketching.value = false;
    }

    if (this.sketchManager.previewItem) {
      this.sketchManager.previewItem.remove(this.app.scene);
      this.sketchManager.previewItem = null;
    }

    this.sketchManager.planeMgr.removeAll();
    if (this.sketchManager.sketchSession) {
      this.sketchManager.sketchSession.currentSketchPlane = null;
    }

    if (this.hasPreEditCameraState) {
      this.restoreCameraState();
    } else {
      this.app.camera.lookAt(0, 0, 0);
      const controls = this.app.controls.instance;
      if (controls) controls.enabled = true;
    }
    this.app.renderOnce();
  }
  // 获取是否处于编辑模式（供外部检查）
  public getIsEditingMode(): boolean {
    return this.isEditingMode;
  }
}
