// CreateCommand.ts
import * as THREE from 'three';
import { SketchManager } from '../managers/sketchManager';
import AppManager from '../AppManager';
import { ArcItem, CircleItem, LineItem, PointItem, RectItem, SplineCurveItem } from '../geometry/sketchs';




export abstract class CreateCommand {
  protected points: THREE.Vector3[] = [];
  protected previewItem: LineItem | CircleItem | ArcItem | PointItem | RectItem | SplineCurveItem | null = null;

  constructor(
    protected app: AppManager,
    protected manager: SketchManager
  ) {}

  /** 鼠标点击输入点 */
  abstract onClick(point: THREE.Vector3): void;

  /** 鼠标移动更新预览 */
  abstract onMove(point: THREE.Vector3): void;

  /** 是否完成所有点输入 */
  abstract isFinished(): boolean;

  /** 创建图元对象（最终实体） */
  abstract createItem(): LineItem | CircleItem | ArcItem | PointItem | RectItem | SplineCurveItem | null;

  /** 绘制预览图元 */
  abstract updatePreview(point: THREE.Vector3): void;

  /** 重置指令（退出） */
  reset() {
    this.points = [];
    if (this.previewItem) {
      this.previewItem.remove?.(this.app.scene);
    }
    this.previewItem = null;
    this.manager.previewItem = null;
  }

  /** 完成创建 */
  finish() {
    const item = this.createItem();
    if (item) {
      item.draw(this.app.scene);
      this.manager.sketch.items.push(item);

    }
    this.reset();
  }
}
