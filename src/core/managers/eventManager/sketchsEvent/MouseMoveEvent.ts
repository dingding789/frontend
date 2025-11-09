// MouseMoveEvent.ts
import * as THREE from 'three';
import { MouseEventBase } from '../MouseEventBase';
import { SplineCurveItem } from '../../../geometry/sketchs/SplineCurveItem';


// -------------------- 鼠标移动事件 --------------------
export class MouseMoveEvent extends MouseEventBase {
  protected eventType(): string {
    return 'mousemove';
  }

  protected handleEvent(e: MouseEvent): void {
    const { app, manager, session } = this;
    if (!session.isSketching.value) return;

    const dom = app.renderer.domElement;
    const rect = dom.getBoundingClientRect();
    session.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    session.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    session.raycaster.setFromCamera(session.mouse, app.camera);

    // 拖拽已落地样条控制点
    if (session.splineDrag && session.currentSketchPlane) {
      const hit = new THREE.Vector3();
      if (session.raycaster.ray.intersectPlane(session.currentSketchPlane, hit)) {
        session.splineDrag.item.setPoint(session.splineDrag.index, hit, app.scene);
        app.renderOnce();
      }
      return;
    }

    if (!session.currentSketchPlane) return;
    const intersect = new THREE.Vector3();
    if (!session.raycaster.ray.intersectPlane(session.currentSketchPlane, intersect)) return;

    // 样条曲线预览
    if (session.currentTool === 'spline' && manager.previewItem instanceof SplineCurveItem) {
      SplineCurveItem.handleSplineTool(app, manager, intersect, 'preview');
      return;
    }

    // 其它几何预览
    if (manager.previewItem && typeof manager.previewItem.drawPreview === 'function') {
      manager.previewItem.drawPreview(app.scene, intersect);
      app.renderOnce();
    }
  }
}


// -------------------- 鼠标按下事件 --------------------
export class MouseDownEvent extends MouseEventBase {
  protected eventType(): string {
    return 'mousedown';
  }

  protected handleEvent(e: MouseEvent): void {
    const { app, manager, session } = this;
    if (!session.isSketching.value || session.currentTool !== 'spline') return;

    const rect = app.renderer.domElement.getBoundingClientRect();
    session.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    session.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    session.raycaster.setFromCamera(session.mouse, app.camera);

    const items = (manager.sketchItems.value || []) as any[];
    const handles: THREE.Object3D[] = [];
    for (const it of items) {
      if (it instanceof SplineCurveItem) handles.push(...it.getHandleObjects());
    }

    const hits = session.raycaster.intersectObjects(handles, true);
    if (hits.length > 0) {
      const info = (hits[0].object as any).userData || {};
      if (info?.owner instanceof SplineCurveItem && typeof info.index === 'number') {
        session.splineDrag = { item: info.owner, index: info.index };
        session.suppressNextClick = true;
      }
    }
  }
}


// -------------------- 鼠标抬起事件 --------------------
export class MouseUpEvent extends MouseEventBase {
  protected eventType(): string {
    return 'mouseup';
  }

  protected handleEvent(): void {
    const { session } = this;
    if (session.splineDrag) session.splineDrag = null;
  }
}


// -------------------- 双击事件 --------------------
export class MouseDoubleClickEvent extends MouseEventBase {
  protected eventType(): string {
    return 'dblclick';
  }

  protected handleEvent(): void {
    const { app, manager, session } = this;
    if (!session.isSketching.value) return;
    if (session.currentTool !== 'spline') return;
    if (manager.previewItem instanceof SplineCurveItem) {
      SplineCurveItem.handleSplineTool(app, manager, null, 'finish');
    }
  }
}
