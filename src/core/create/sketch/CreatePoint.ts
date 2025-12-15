import * as THREE from 'three';
import { CreateCommand } from '../CreateCommand';
import { PointItem } from '../../geometry/sketchs/PointItem';
import AppManager from '../../AppManager';
import { SketchManager } from '../../managers/sketchManager';

export class CreatePoint extends CreateCommand {
    createItem() {
        if (!this.points || this.points.length === 0) return null;
        return new PointItem(this.points[0].clone());
    }

    constructor(app: AppManager, manager: SketchManager) {
        super(app, manager);
        this.onClick = this.onClick.bind(this);
        this.onMove = this.onMove.bind(this);
    }

    onClick(point: THREE.Vector3) {
        this.points.push(point.clone());
        if (this.isFinished()) this.finish();
    }

    onMove(point: THREE.Vector3) {
        this.updatePreview(point);
    }

    isFinished(): boolean {
        return this.points.length >= 1;
    }

    // 预览：光标位置显示一个点
    updatePreview(point: THREE.Vector3) {
        if (!this.previewItem) {
            this.previewItem = new PointItem(point.clone());
            this.manager.previewItem = this.previewItem;
            this.previewItem.draw(this.app.scene);
            return;
        }
        // 移动已创建的预览点
        const obj = this.previewItem.object3D;
        if (obj) obj.position.copy(point);
    }

    finish() {
        if (!this.points.length) return;
        const p = this.points[0];

        // 清理预览
        if (this.previewItem) {
            try { this.previewItem.remove(this.app.scene); } catch {}
            this.previewItem = null;
            this.manager.previewItem = null;
        }

        // 落地点
        const item = new PointItem(p.clone());
        item.draw(this.app.scene);
        this.manager.sketch.items.push(item);

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