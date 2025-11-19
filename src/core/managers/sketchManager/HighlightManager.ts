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
  private persistent = false; // 是否为持久高亮（由外部显式触发）

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

   /**
   * 设置所有草图项
   * @param sketchid 草图id
   */

  public async highlightBySketchId(id: number | string) {
    try {
      // 先尝试通过 manager.sketchList 找到对应的索引（allSketchItems 的数组顺序与 sketchList 对应）
      const list = this.manager.sketchList?.value || [];
      let found: SketchItem[] | null = null;
      let idx = list.findIndex((it: any) => String(it.id) === String(id));
      if (idx >= 0 && this.manager.allSketchItems && this.manager.allSketchItems[idx]) {
        found = this.manager.allSketchItems[idx];
      }
      // 如果未找到，尝试通过 manager.sketchData.loadById 加载该草图（如果可用）
      if (!found && this.manager.sketchData && typeof this.manager.sketchData.loadById === 'function') {
        // 如果尚未加载该草图，尝试通过后端加载（loadById）
        await this.manager.sketchData.loadById(Number(id));
        // 加载后，sketchList 与 allSketchItems 应已更新，重新查找索引
        const list2 = this.manager.sketchList?.value || [];
        const newIdx = list2.findIndex((it: any) => String(it.id) === String(id));
        if (newIdx >= 0 && this.manager.allSketchItems && this.manager.allSketchItems[newIdx]) {
          found = this.manager.allSketchItems[newIdx];
        }
      }
      // 如果找到则高亮并渲染（持久高亮）
      if (found) {
        this.highlight(found, true);
        this.app.renderOnce();
      } else {
        // 未找到则取消持久高亮并渲染
        this.highlight(null, false);
        this.app.renderOnce();
      }
    } catch (err) {
      console.error('[HighlightManager] highlightBySketchId 错误', err);
    }
  }


  setItems(items: SketchItem[]) {
    this.allItems = items; // 将传入的草图项数组赋值给 allItems 属性
  }

  /**
   * 高亮指定的草图项数组，如果已有高亮项则恢复其正常颜色
   * @param items 需要高亮的草图项数组或 null
   */
  highlight(items: SketchItem[] | null, persistent = false) {
    // 先恢复上一次的高亮颜色
    if (Array.isArray(this.highlightedItem)) {
      this.highlightedItem.forEach(prevItem => {
        const prevMat = (prevItem.object3D as any)?.material;
        if (prevMat?.color) prevMat.color.setHex(this.normalColor);
        if (prevMat) prevMat.needsUpdate = true;
      });
    } else if (this.highlightedItem) {
      const mat = (this.highlightedItem.object3D as any)?.material;
      if (mat?.color) mat.color.setHex(this.normalColor);
      if (mat) mat.needsUpdate = true;
    }

    // 更新当前高亮项与持久标记
    this.highlightedItem = items;
    this.persistent = !!(items && persistent);

    // 设置新的高亮颜色（仅高亮当前一组）
    if (items && items.length > 0) {
      items.forEach((it) => {
        const mat = (it.object3D as any)?.material;
        if (mat?.color) mat.color.setHex(this.highlightColor);
        if (mat) mat.needsUpdate = true;
      });
    }

    // 强制渲染
    try { this.app.renderOnce(); } catch {}
    setTimeout(()=>{ try{ this.app.renderOnce(); }catch{} }, 40);
    setTimeout(()=>{ try{ this.app.renderOnce(); }catch{} }, 150);
  }

  /**
   * 检测射线相交的草图项并高亮（支持子对象命中，点击画布空白处取消）
   */
  pick(raycaster: THREE.Raycaster, items: SketchItem[][]) {
    const roots = items.flat().map(i => i.object3D).filter(Boolean) as THREE.Object3D[];
    const intersects = raycaster.intersectObjects(roots, true);

    // 未命中：无条件取消高亮并通知 UI
    if (intersects.length === 0) {
      this.highlight(null, false);
      try { this.manager?.emit?.('sketch-picked', null); } catch {}
      return null;
    }

    const hitObj = intersects[0].object;

    // 找到所属草图组
    let hitGroup: SketchItem[] | null = null;
    let groupIndex = -1;
    for (let i = 0; i < items.length; i++) {
      const group = items[i];
      if (group && group.some(it => this.isDescendantOf(hitObj, it.object3D as THREE.Object3D))) {
        hitGroup = group;
        groupIndex = i;
        break;
      }
    }
    if (!hitGroup) return null;

    // 与 sketchList 顺序对应获取 id
    const id = this.manager?.sketchList?.value?.[groupIndex]?.id ?? null;

    // 命中草图：直接高亮（不再因再次点击同一草图而取消）
    this.highlight(hitGroup, true);
    try { this.manager?.emit?.('sketch-picked', id); } catch {}
    return hitGroup;
  }

  // 判断 child 是否为 root 的子孙（或本身）
  private isDescendantOf(child: THREE.Object3D, root: THREE.Object3D | null): boolean {
    if (!child || !root) return false;
    let cur: THREE.Object3D | null = child;
    while (cur) {
      if (cur === root) return true;
      cur = cur.parent;
    }
    return false;
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
