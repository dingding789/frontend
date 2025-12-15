import * as THREE from 'three';
import { ExtrudeItem } from '../../geometry/features/ExtrudeItem';
import { ref } from 'vue';
import { SketchItem } from '../../geometry/sketchs';
/**
 * ExtrudeManager 负责：
 * 1. 草图拾取
 * 2. 预览创建/更新
 * 3. 确认拉伸
 * 4. 与 Vue 弹窗（ExtrudeDialog.vue）通信
 */
export class ExtrudeManager {

  private highlightedItem: SketchItem | SketchItem[] | null = null; // 当前高亮的草图项（可为单个或数组）
  private allItems: SketchItem[] = []; // 所有草图项的集合
  private raycaster = new THREE.Raycaster(); // 用于射线检测的 Raycaster
  private mouse = new THREE.Vector2(); // 用于存储鼠标位置的 Vector2
  private material = new THREE.MeshStandardMaterial({ color: 0x88ccff });

  // 弹窗相关状态
  public dialogVisible = ref(false);
  public selectedSketch: any;
  public startValue = 0;
  public endValue = 10;

  constructor(private app: any, private sketchManager: any) {
    this.app = app;
    this.sketchManager = sketchManager;
  }

  // 草图名称
  public get selectedSketchName(): string {
    if (!this.selectedSketch) return '';
    const s: any = this.selectedSketch;
    if (s.type === 'rect' && s.p1 && s.p2) return `矩形 (${s.p1}) → (${s.p2})`;
    if (s.type === 'circle' && s.p1) return `圆心(${s.p1}) 半径 ${s.radius}`;
    return s.name || s.id || s.type || 'sketch';
  }

  // 点击“选择草图”后启动一次性拾取
  public enablePickMode() {
    console.log('enable pick mode');
    this.app.renderer.domElement.addEventListener('click', this.onMouseClick.bind(this));

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
    const allItems:SketchItem[][] = this.sketchManager.allSketchItems;

    // 使用 pick 方法检测射线相交
    const hit = this.pick(this.raycaster, allItems);
    this.selectedSketch = hit;
    console.log('hit', hit);
  }
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

      return hit; // 返回找到的草图项
    }
    // 如果没有相交的物体，取消高亮

    return null; // 返回 null
  }



  // 确认：构造拉伸，关闭对话框
  public confirmExtrude() {
    if (!this.selectedSketch) return;
    this.createExtrudeFromItem(this.selectedSketch, { start: this.startValue, end: this.endValue, tryWasm: true }, 'XY');
    this.dialogVisible.value = false;
    this.selectedSketch = null;
  }

  // 取消：关闭对话框
  public cancelDialog() {
    this.dialogVisible.value = false;
    this.selectedSketch = null;
  }

  // 创建拉伸体
  private createExtrudeFromItem(item: any, params: any, plane: string): THREE.Mesh | null {
    const mesh = ExtrudeItem.createExtrudeMesh(item, params, plane, this.material);
    if (mesh) {
      this.app.scene.add(mesh);
      this.app.needsRender = true;
      return mesh;
    }
    return null;
  }
}