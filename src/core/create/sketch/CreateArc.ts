// CreateArc.ts
import * as THREE from 'three';
import { CreateCommand } from '../CreateCommand';
import { ArcItem } from '../../geometry/sketchs/ArcItem';
import AppManager from '../../AppManager';
import { SketchManager } from '../../managers/sketchManager';

type ArcMode = 'threePoints' | 'centerStartEnd';

export class CreateArc extends CreateCommand {
  constructor(
    app: AppManager,
    manager: SketchManager,
    private mode: ArcMode //= 'threePoints'
  ) {
    super(app, manager);
  }

  onClick(point: THREE.Vector3) {
    this.points.push(point.clone());
    if (this.points.length === 1) {
      // 创建预览 ArcItem
      this.previewItem = new ArcItem([point.clone()], this.mode);
      this.manager.previewItem = this.previewItem;
    }

    if (this.isFinished()) {
      this.finish();
    }
  }

  onMove(point: THREE.Vector3) {
    if (!this.previewItem) return;
    this.updatePreview(point);
  }

  isFinished(): boolean {
    return this.points.length === 3;
  }

  createItem() {
    if (this.points.length < 3) return null;
    return new ArcItem(
      [...this.points.map(p => p.clone())],
      this.mode
    );
  }

  updatePreview(cursor: THREE.Vector3) {
    if (!this.previewItem) return;
    if (!(this.previewItem instanceof ArcItem)) return;

    const pts = [...this.points];
    if (pts.length === 1) {
      // 第二点还没确定
      pts.push(cursor);
    }
    pts[2] = cursor;

    this.previewItem.points = pts;
    this.previewItem.setMode(this.mode);
    this.previewItem.drawPreview(this.app.scene, cursor);
  }
}
