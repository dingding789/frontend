import * as THREE from 'three';
import { SketchItem } from '../../geometry/sketchs';
import { SketchStruct } from '../sketchManager/SketchManager';
import { App } from 'vue';
import AppManager from '../../AppManager';

/**
 * HighlightManager 类用于管理草图项的高亮显示。
 * 支持鼠标点击高亮、射线检测高亮、批量高亮等功能。
 */
export class HighlightManager {
  private highlightedItem: SketchItem | SketchItem[] | null = null; // 当前高亮的草图项（可为单个或数组）
  private highlightColor = 0xffaa00; // 高亮颜色（橙色）
  private normalColor = 0x00ffff; // 正常颜色（青色）
  private allItems: SketchStruct[] = []; // 所有草图项的集合
  private raycaster = new THREE.Raycaster(); // 用于射线检测的 Raycaster
  private mouse = new THREE.Vector2(); // 用于存储鼠标位置的 Vector2


  /**
   * 构造函数，接收 app 和 manager 参数并设置鼠标点击事件监听器
   * @param app THREE 应用管理器
   * @param manager 草图管理器
   */
  constructor(private app: AppManager) {
    // 绑定鼠标点击事件到 onMouseClick 方法
    this.app.renderer.domElement.addEventListener('click', this.onMouseClick.bind(this));
  }

  /**
   * 设置所有草图项
   * @param items 草图项数组
   */
  setItems(items: SketchStruct[]) {
    this.allItems = items; // 将传入的草图项数组赋值给 allItems 属性
  }



  /**
   * 高亮指定的草图项数组，如果已有高亮项则恢复其正常颜色
   * @param items 需要高亮的草图项数组或 null
   * @param persistent 是否为持久高亮
   */
  highlight(items: SketchItem[] | null, persistent = false) {
    // 先恢复上一次的高亮颜色
    if (Array.isArray(this.highlightedItem)) {
      this.highlightedItem.forEach(previousItem => {
        const previousMaterial = (previousItem.object3D as any)?.material;
        if (previousMaterial?.color) previousMaterial.color.setHex(this.normalColor);
        if (previousMaterial) previousMaterial.needsUpdate = true;
      });
    } else if (this.highlightedItem) {
      const material = (this.highlightedItem.object3D as any)?.material;
      if (material?.color) material.color.setHex(this.normalColor);
      if (material) material.needsUpdate = true;
    }

    // 更新当前高亮项
    this.highlightedItem = items;
    //this.persistent = !!(items && persistent);

    // 设置新的高亮颜色（仅高亮当前一组）
    if (items && items.length > 0) {
      items.forEach((item) => {
        const material = (item.object3D as any).material;
        if (material?.color) material.color.setHex(this.highlightColor);
        if (material) material.needsUpdate = true;
      });
    }

    // 强制渲染
    try { this.app.renderOnce(); } catch {}
    setTimeout(() => { try { this.app.renderOnce(); } catch {} }, 40);
    //setTimeout(() => { try { this.app.renderOnce(); } catch {} }, 150);
  }

  /**
   * 检测射线相交的草图项并高亮（支持子对象命中，点击画布空白处取消）
   * @param raycaster 射线检测器
   * @param sketchGroups 草图项二维数组（每组为一个草图）
   */
  pick(raycaster: THREE.Raycaster, sketchGroups: SketchStruct[]) {
    // 获取所有草图项的 Object3D 根对象
    const rootObjects = sketchGroups.flatMap(item => item.items.map(subItem => subItem.object3D)).filter(Boolean) as THREE.Object3D[];
    // 进行射线检测
    const intersects = raycaster.intersectObjects(rootObjects, true);

    // 未命中：无条件取消高亮并同步列表高亮为 null
    if (intersects.length === 0) {
      this.highlight(null, false);
      // 直接设置列表高亮为 null
      if (typeof (window as any).setListSelectedId === 'function') {
        (window as any).setListSelectedId(null);
      }
      return null;
    }
    //取出射线检测命中的第一个对象（即用户点击到的 3D 对象）
    const hitObject = intersects[0].object;

    // 找到所属草图组，保存射线命中所属的草图项的数组，如果没有命中则为null
    let hitGroup: SketchStruct | null = null;
    let groupIndex = -1;
    for (let i = 0; i < sketchGroups.length; i++) {
      const group = sketchGroups[i];
      if (group && group.items.some(item => this.isDescendantOf(hitObject, item.object3D as THREE.Object3D))) {
        hitGroup = group;
        groupIndex = i;
        break;
      }
    }
    if (!hitGroup) return null;

    // 与 sketchList 顺序对应获取 id，并转为数字类型
    const sketchList = this.app.sketchMgr?.sketchList?.value || [];
    const idRaw = sketchList[groupIndex]?.id ?? null;
    const sketchId = idRaw != null ? Number(idRaw) : null;

    // 命中草图：高亮并同步设置列表高亮
    this.highlight(hitGroup.items, true);
    if (typeof (window as any).setListSelectedId === 'function') {
      (window as any).setListSelectedId(sketchId);
    }
    return hitGroup;
  }

  /**
   * 判断 child 是否为 root 的子孙（或本身）
   * @param child 子对象
   * @param root 根对象
   */
  //判断3D层级关系，判断命中的对象是否属于某个草图组的根对象
  private isDescendantOf(child: THREE.Object3D, root: THREE.Object3D | null): boolean {
    if (!child || !root) return false;
    let current: THREE.Object3D | null = child;
    while (current) {
      if (current === root) return true;//找到目标父对象
      current = current.parent;  //继续向上
    }
    return false;//没有找到返回false
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
    const allSketchGroups: SketchStruct[] = this.app.sketchMgr.allSketch;
    // 使用 pick 方法检测射线相交并高亮
    this.pick(this.raycaster, allSketchGroups);
    this.app.renderOnce(); // 重新渲染场景以显示高亮
  }
}
