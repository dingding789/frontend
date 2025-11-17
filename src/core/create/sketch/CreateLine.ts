import * as THREE from 'three';
import { CreateCommand } from '../CreateCommand';
import { LineItem } from '../../geometry/sketchs/LineItem';

export class CreateLine extends CreateCommand {

  createItem(): LineItem | null {
    if (this.points.length < 2) return null;
    const [p0, p1] = this.points;
    return new LineItem(p0.clone(), p1.clone());
  }
  updatePreview(point: THREE.Vector3): void {
    // 若还未有预览，创建一次
    if (!this.previewItem) {
      this.previewItem = new LineItem(this.points[0]?.clone() ?? point.clone(), null);
      this.manager.previewItem = this.previewItem;
    }
    if (this.previewItem instanceof LineItem) {
      this.previewItem.drawPreview(this.app.scene, point);
    }
  }
  constructor(app: any, manager: any) {
    super(app, manager);
    this.onClick = this.onClick.bind(this);
    this.onMove = this.onMove.bind(this);
  }

  onClick(point: THREE.Vector3) {
    this.points.push(point.clone());
    if (this.points.length === 1) {
      // 创建预览
      this.previewItem = new LineItem(point.clone(), null);
      this.manager.previewItem = this.previewItem;
    }
    if (this.isFinished()) this.finish();
  }

  onMove(point: THREE.Vector3) {
    this.updatePreview(point);

  }

  isFinished(): boolean {
    return this.points.length >= 2;
  }

  finish() {
    if (this.points.length < 2) return;
    const [p0, p1] = this.points;

    // 清理预览
    if (this.previewItem) {
      try { this.previewItem.remove(this.app.scene); } catch {}
      this.previewItem = null;
      this.manager.previewItem = null;
    }

    // 落地线段
    const item = new LineItem(p0.clone(), p1.clone());
    item.draw(this.app.scene);
    // 记录到草图集合（与 LineItem.handleLineTool 保持一致）
    this.manager.sketchItems?.value?.push(item);

    // 重置
    this.points.length = 0;

  }

  cancel() {
    if (this.previewItem) {
      try { this.previewItem.remove(this.app.scene); } catch {}
      this.previewItem = null;
      this.manager.previewItem = null;

    }
    this.points.length = 0;
  }
}