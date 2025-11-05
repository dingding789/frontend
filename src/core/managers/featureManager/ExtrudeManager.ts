import AppManager from "../../scene/SceneManager";
import * as THREE from 'three';
import { SketchItem } from '../../geometry/sketchs/SketchItem';
import { toRaw } from 'vue';
import { CircleItem } from '../../geometry/sketchs/CircleItem';
import { ExtrudeItem } from '../../geometry/features/ExtrudeItem';
import { onExtrudeMouseClick } from '../eventManager/featuresEvent/extrudeEvents';
import { CircleExtrudeItem } from '../../geometry/features/CircleExtrudeItem';

/**
 * ExtrudeManager
 * 从草图项（rect、circle 等）生成三维拉伸体，并管理相关事件
 */
export class ExtrudeManager {
  private app: AppManager; // 应用管理器实例
  private material: THREE.MeshStandardMaterial; // 拉伸体的材质
  private height = 10; // 默认拉伸高度
  public eventManager: InstanceType<typeof ExtrudeManager.EventManager>; // 事件管理器实例

  constructor(app: AppManager) {
    this.app = app;
    this.material = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      metalness: 0.2,
      roughness: 0.6,
    });
    this.eventManager = new ExtrudeManager.EventManager(app, this.app.sketchMgr);
  }

  /**
   * 从草图项创建拉伸几何体
   * @param item 草图项对象，例如rect、circle等
   * @param params 创建拉伸体时的参数，可选
   * @param plane 拉伸体所在的平面，默认为'XY'
   * @returns 返回生成的THREE.Mesh拉伸体对象，如果失败则返回null
   */
  public createExtrudeFromItem(item: any, params: any = {}, plane: string = 'XY'): THREE.Mesh | null {
    // 通过ExtrudeItem的静态方法创建拉伸体
    const mesh = ExtrudeItem.createExtrudeMesh(item, params, plane, this.material);
    if (mesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.app.scene.add(mesh);
      return mesh;
    }
    return null;
  }

  /**
   * 生成拉伸体预览（不落地到场景，仅返回mesh）
   * @param item 草图项对象，例如rect、circle等
   * @param params 创建拉伸体时的参数
   * @param plane 拉伸体所在的平面，默认为'XY'
   * @returns 返回生成的THREE.Mesh拉伸体对象，如果失败则返回null
   */
  public createPreviewExtrudeFromItem(item: any, params: any, plane: string = 'XY'): THREE.Mesh | null {
    // 通过ExtrudeItem的静态方法创建预览体（不添加到场景）
    const mesh = ExtrudeItem.createExtrudeMesh(item, params, plane, this.material);
    if (mesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    }
    return null;
  }

  /**
   * 设置拉伸高度
   * @param height 新的拉伸高度
   */
  public setHeight(height: number) {
    this.height = height; // 更新类的height属性值
  }

  // ========== EventManager 相关逻辑 ==========

  /**
   * 事件管理器，负责交互和拉伸体生成
   */
  public static EventManager = class EventManager {
    private raycaster = new THREE.Raycaster(); // 射线投射器对象
    private mouse = new THREE.Vector2(); // 鼠标位置的二维向量
    private extrudedMeshes: THREE.Mesh[] = []; // 已拉伸的网格对象数组
    private material: THREE.MeshStandardMaterial; // 拉伸体的材质
    public onSketchPicked?: (sketch: SketchItem) => void; // 当草图项被选中时触发的回调函数

    constructor(private app: any, private manager: any) {
      this.app = app;
      this.material = new THREE.MeshStandardMaterial({
        color: 0x66ccff,
        metalness: 0.2,
        roughness: 0.6,
      });
    }

    /**
     * 初始化事件监听器
     */
    init() {
      this.app.renderer.domElement.addEventListener('click', this.onMouseClick.bind(this)); // 绑定鼠标点击事件监听器
    }

    /**
     * 对选中的草图项进行拉伸
     * @param sketch 草图项数组
     */
    extrude(sketch: SketchItem[]) {
      const allItems = toRaw(sketch); // 获取草图项原始对象
      allItems.forEach((item) => {
        if (!item || !item.object3D) return; // 如果草图项或其3D对象不存在，跳过
        if (item.type === 'circle') {
          CircleExtrudeItem.extrudeCircle(item as CircleItem, this.app, this.material, 20); // 使用特征类静态方法
        }
        // TODO: 其他类型 (line, rect, spline) 可在此扩展
      });
    }

    /**
     * 通过射线投射器选择草图项
     * @param raycaster 射线投射器对象
     * @param items 草图项二维数组
     * @returns 返回选中的SketchItem对象，如果未选中则返回null
     */
    pick(raycaster: THREE.Raycaster, items: SketchItem[][]): SketchItem | null {
      const objects = items.flat().map(i => i.object3D).filter(Boolean) as THREE.Object3D[]; // 创建场景中的物体数组
      const intersects = raycaster.intersectObjects(objects); // 获取与射线相交的物体
      if (intersects.length > 0) {
        const obj = intersects[0].object; // 获取第一个相交的物体
        const hit = items.flat().find(j => j.object3D === obj) ?? null; // 查找对应的草图项
        return hit; // 返回选中的草图项
      }
      return null; // 返回null
    }

    /**
     * 处理鼠标点击事件
     * @param event 鼠标点击事件
     */
    private onMouseClick(event: MouseEvent) {
      const hit = onExtrudeMouseClick(this.app, this.manager, event, this.onSketchPicked);
      if (hit) {
        this.extrude([hit]); // 对选中的草图项进行拉伸
      }
    }
  }
}
