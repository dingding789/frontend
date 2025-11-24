import * as THREE from 'three';
import { Scene } from 'three';
import { SketchItem } from '../../../geometry/sketchs';

export class SelectSketch {
  private highlightedItem: SketchItem | null = null;

  // 绑定事件处理函数
  private onMouseMove = this.handleMouseMove.bind(this);
  private onMouseDown = this.handleMouseDown.bind(this);
  private onMouseUp = this.handleMouseUp.bind(this);

  private dom: HTMLElement | Window;

  constructor(domElementId: string = 'three-canvas') {
    // 绑定鼠标事件
    this.dom = document.getElementById(domElementId) || window;
    this.dom.addEventListener('mousemove', this.onMouseMove);
    this.dom.addEventListener('mousedown', this.onMouseDown);
    this.dom.addEventListener('mouseup', this.onMouseUp);
  }

  // 鼠标移动时进行射线检测并高亮
  private handleMouseMove(event: MouseEvent) {
    // 你需要根据实际项目获取 scene 和 camera
    // 这里只是伪代码示例
    const scene: Scene = (window as any).threeScene;
    const camera: THREE.Camera = (window as any).threeCamera;
    if (!scene || !camera) return;

    // 计算鼠标在画布上的归一化坐标
    const rect = (this.dom as HTMLElement).getBoundingClientRect?.() || { left: 0, top: 0, width: 1, height: 1 };
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    this.getHoveredSketchItem(scene, raycaster);
  }

  private handleMouseDown(event: MouseEvent) {
    // 可扩展
  }

  private handleMouseUp(event: MouseEvent) {
    // 可扩展
  }

  /**
   * 高亮指定草图项（或取消高亮）
   */
  highlight(sketchItem: SketchItem | null, persistent = false) {
    // 取消上一次高亮
    if (this.highlightedItem && this.highlightedItem.object3D) {
      const mat = (this.highlightedItem.object3D as any).material;
      if (mat && mat.color && (this.highlightedItem as any)._originColor) {
        mat.color.set((this.highlightedItem as any)._originColor);
        mat.needsUpdate = true;
      }
    }

    // 设置新高亮
    if (sketchItem && sketchItem.object3D) {
      const mat = (sketchItem.object3D as any).material;
      if (mat && mat.color) {
        if (!(sketchItem as any)._originColor) {
          (sketchItem as any)._originColor = mat.color.getHex();
        }
        mat.color.set(0xffff00); // 高亮色
        mat.needsUpdate = true;
      }
      this.highlightedItem = sketchItem;
    } else {
      this.highlightedItem = null;
    }
  }

  /**
   * 检测射线相交的草图项并高亮（支持子对象命中，点击画布空白处取消）
   * @param scene THREE.Scene
   * @param raycaster THREE.Raycaster
   */
  getHoveredSketchItem(scene: Scene, raycaster: THREE.Raycaster): any {
    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length === 0) {
      this.highlight(null, false); // 取消高亮
      return null;
    }
    // 找到第一个有sketchItem 的对象
    for (const hit of intersects) {
      const sketchItem = hit.object.userData?.sketchItem;
      if (sketchItem) {
        this.highlight(sketchItem, true); // 高亮
        return sketchItem;
      }
    }
    // 没有找到草图对象则取消高亮
    this.highlight(null, false);
    return null;
  }
}