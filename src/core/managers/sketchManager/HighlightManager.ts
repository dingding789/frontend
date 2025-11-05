// HighlightManager.ts
// 草图高亮管理器，负责处理草图项的高亮显示与交互
import * as THREE from 'three';
import { SketchItem } from '../../geometry/sketchs';

/**
 * HighlightManager 类用于管理草图项的高亮显示。
 * 支持鼠标点击高亮、射线检测高亮、批量高亮等功能。
 */
export class HighlightManager {
  private highlightedItem: SketchItem | SketchItem[] | null = null; // 当前高亮的草图项（可为单个或数组）
  private highlightColor = 0xffaa00; // 高亮颜色（橙色）
  private normalColor = 0x00ffff; // 正常颜色（青色）
  private allItems: SketchItem[] = []; // 所有草图项的集合
  private raycaster = new THREE.Raycaster(); // 用于射线检测的 Raycaster
  private mouse = new THREE.Vector2(); // 用于存储鼠标位置的 Vector2

  /**
   * 构造函数，接收 app 和 manager 参数并设置鼠标点击事件监听器
   * @param app THREE 应用管理器
   * @param manager 草图管理器
   */
  constructor(private app: any, private manager: any) {
    // 绑定鼠标点击事件到 onMouseClick 方法
    this.app.renderer.domElement.addEventListener('click', this.onMouseClick.bind(this));
  }

  /**
   * 设置所有草图项
   * @param items 草图项数组
   */
  setItems(items: SketchItem[]) {
    this.allItems = items; // 将传入的草图项数组赋值给 allItems 属性
  }

  /**
   * 高亮指定的草图项数组，如果已有高亮项则恢复其正常颜色
   * @param items 需要高亮的草图项数组或 null
   */
  highlight(items: SketchItem[] | null) {
    // 恢复之前高亮的项目颜色
    if (Array.isArray(this.highlightedItem)) {
      this.highlightedItem.forEach(prevItem => {
        const mat = (prevItem.object3D as any)?.material;
        if (mat?.color) mat.color.setHex(this.normalColor);
      });
    } else if (this.highlightedItem) {
      const mat = (this.highlightedItem.object3D as any)?.material;
      if (mat?.color) mat.color.setHex(this.normalColor);
    }

    // 更新当前高亮项
    this.highlightedItem = items;

    // 设置新的高亮颜色
    if (items && items.length > 0) {
      items.forEach(it => {
        const mat = (it.object3D as any)?.material;
        if (mat?.color) mat.color.setHex(this.highlightColor);
      });
    }
  }

  /**
   * 检测射线相交的草图项并高亮
   * @param raycaster THREE 射线检测器
   * @param items 草图项二维数组（历史+当前）
   * @returns 命中的草图项或 null
   */
  pick(raycaster: THREE.Raycaster, items: SketchItem[][]) {
    // 将草图项转换为 THREE.Object3D 数组，并过滤掉 null 值
    const objects = items.flat().map(i => i.object3D).filter(Boolean) as THREE.Object3D[];
    // 使用射线检测器检测与 objects 的相交
    const intersects = raycaster.intersectObjects(objects);
    // 如果有相交的物体，高亮第一个相交的草图项
    if (intersects.length > 0) {
      const obj = intersects[0].object;
      // 找到与相交物体对应的 SketchItem
      const hit = items.find(i => i.find(j => j.object3D === obj))?? null;
      this.highlight(hit); // 高亮找到的草图项
      return hit; // 返回找到的草图项
    }
    // 如果没有相交的物体，取消高亮
    this.highlight(null);
    return null; // 返回 null
  }

  // ---------------- 鼠标点击高亮 ----------------
  /**
   * 鼠标点击事件处理函数
   * @param event 鼠标点击事件
   */
  private onMouseClick(event: MouseEvent) {
    // 获取渲染器 DOM 元素的边界矩形
    const rect = this.app.renderer.domElement.getBoundingClientRect();
    // 计算鼠标位置归一化坐标
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    // 根据鼠标位置设置射线检测器的方向
    this.raycaster.setFromCamera(this.mouse, this.app.camera);
    // 在所有草图（当前+历史）中查找被点击的元素
    const allItems:SketchItem[][] = this.manager.allSketchItems;
    // 使用 pick 方法检测射线相交并高亮
    this.pick(this.raycaster, allItems);
    this.app.renderOnce(); // 重新渲染场景以显示高亮
  }
}
