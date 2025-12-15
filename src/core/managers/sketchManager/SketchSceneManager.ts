import * as THREE from 'three';
import AppManager from '../../AppManager';
import { SketchManager } from '.';

/**
 * SketchSceneManager
 * 负责管理 THREE.js 场景中的草图对象，包括：
 * - 清空当前草图元素
 * - 删除单个草图元素
 * - 保证渲染更新
 */
export class SketchSceneManager {
  /**
   * @param app 主应用管理器，必须包含 scene 和 renderOnce 方法
   * @param manager 草图管理器，必须包含 sketchItems 响应式数组
   */
  constructor(private app: AppManager, private manager: SketchManager) {}

  /**
   * clearSketchObjectsFromScene
   * 从场景中移除所有草图对象，并清空当前 sketchItems
   *
   * 步骤：
   * 1. 遍历场景子对象，将标记为草图对象的 obj 收集到 toRemove
   * 2. 从场景中移除所有收集到的对象
   * 3. 调用每个 SketchItem 的 remove 方法清理资源
   * 4. 清空 manager.sketchItems 数组
   * 5. 调用 renderOnce 重新渲染场景
   */
  clearSketchObjectsFromScene() {
    const toRemove: THREE.Object3D[] = [];

    // 遍历场景子对象，收集草图对象
    this.app.scene.children.forEach((obj: THREE.Object3D) => {
      if (obj.userData.isSketchItem) toRemove.push(obj);
    });

    // 从场景中移除
    toRemove.forEach((obj: THREE.Object3D) => this.app.scene.remove(obj));

    // 调用每个草图元素的 remove 方法
    this.manager.sketch.items.forEach((i: any) => i.remove(this.app.scene));

    // 清空草图数组
    this.manager.sketch.items = [];

    // 渲染一次
    this.app.renderOnce();
  }

  /**
   * removeItem
   * 从场景中移除单个草图元素
   * @param item 要移除的草图对象
   *
   * 步骤：
   * 1. 调用 item.remove 移除自身资源
   * 2. 从 manager.sketchItems 数组中过滤掉该元素
   * 3. 调用 renderOnce 重新渲染场景
   */
  removeItem(item: any) {
    // 从场景中移除
    item.remove(this.app.scene);

    // 从响应式数组中删除
    this.manager.sketch.items = this.manager.sketch.items.filter((i: any) => i !== item);

    // 渲染更新
    this.app.renderOnce();
  }
}
