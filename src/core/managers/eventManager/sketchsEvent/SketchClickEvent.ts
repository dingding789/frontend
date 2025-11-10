import * as THREE from 'three';
import { SketchPlaneName } from '../../sketchManager/SketchManager';
import {
  ArcItem,
  CircleItem,
  LineItem,
  PointItem,
  RectItem,
} from '../../../../core/geometry/sketchs';
import { SplineCurveItem } from '../../../geometry/sketchs/SplineCurveItem';
import { SketchMouseEventBase } from './SketchMouseEventBase';

/**
 * 草图绘制点击事件
 * 对应原 bindEvents.ts 的主要逻辑
 */
export class SketchClickEvent extends SketchMouseEventBase {
  protected eventType(): string {
    return 'click';
  }
  
  protected handleEvent(e: MouseEvent): void {
    const { app, manager, session } = this;

    console.log('SketchClickEvent');
    if (!session.isSketching.value) return;

    // 拖拽刚结束时抑制一次 click
    if (session.suppressNextClick) {
      session.suppressNextClick = false;
      return;
    }

    // 计算归一化坐标与射线
    const mouse = this.getNormalizedMouse(e);
    session.mouse.copy(mouse);
    session.raycaster.setFromCamera(mouse, app.camera);

  // ===== 选择平面 =====
  if (!session.currentSketchPlane) {
    const { plane, planeName } = pickSketchPlane(session.raycaster, manager.planeMgr);
    if (!plane) return;

    session.currentSketchPlane = plane;
    if (planeName) manager.planeMgr.highlightPlane?.(planeName);
    manager.planeMgr.removeAll();
    return;
  }

    // =====获取与平面交点 =====
    const intersect = this.getIntersectOnPlane(mouse, session.currentSketchPlane);
    if (!intersect) return;

    // =====根据当前工具分发 =====
    switch (session.currentTool) {
      case 'spline':
        SplineCurveItem.handleSplineTool(app, manager, intersect, 'add');
        break;
      case 'point':
        PointItem.handlePointTool(app, manager, intersect);
        break;
      case 'line':
        LineItem.handleLineTool(app, manager, intersect);
        break;
      case 'arc':
        ArcItem.handleArcTool(app, manager, intersect, session.arcMode);
        break;
      case 'circle':
        CircleItem.handleCircleTool(app, manager, intersect, session.circleMode, session.currentSketchPlane);
        break;
      case 'rect':
        RectItem.handleRectTool(app, manager, intersect, session.rectMode, session.currentSketchPlane);
        break;
    }

    app.renderOnce();
  }
}


/**
 * 通过射线选择草图平面
 * @param raycaster THREE.Raycaster
 * @param planeMgr 草图平面管理器
 * @returns { plane?: THREE.Plane, planeName?: SketchPlaneName }
 */
export function pickSketchPlane(raycaster: THREE.Raycaster, planeMgr: any): { plane?: THREE.Plane; planeName?: SketchPlaneName } {
  let meshes: THREE.Object3D[] = [];

  if (typeof planeMgr.getMeshes === 'function') {
    meshes = planeMgr.getMeshes();
  } else if (planeMgr.planes) {
    meshes = planeMgr.planes.map((p: any) => p.mesh);
  }

  const intersects = raycaster.intersectObjects(meshes);
  if (intersects.length === 0) return {};

  const planeName = intersects[0].object.name as SketchPlaneName;
  const plane = planeMgr.selectPlane?.(planeName) ?? planeMgr.getCurrentTHREEPlane?.();

  return { plane: plane instanceof THREE.Plane ? plane : undefined, planeName };
}
