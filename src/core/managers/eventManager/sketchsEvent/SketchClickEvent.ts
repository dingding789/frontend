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
import { CreateArc } from '../../../create/sketch/CreateArc';
import { CreateLine } from '../../../create/sketch/CreateLine';
import { CreatePoint } from '../../../create/sketch/CreatePoint';
import { CreateCircle } from '../../../create/sketch/CreateCircle';

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
      case 'point': {
        // 使用 CreatePoint 命令处理单击创建点
        let cmd = (session as any).pointCmd as CreatePoint | undefined;
        if (!cmd) (session as any).pointCmd = cmd = new CreatePoint(app, manager);
        cmd.onMove?.(intersect);
        cmd.onClick(intersect);
        if (cmd.isFinished?.()) {
          cmd.finish?.();
          (session as any).pointCmd = null;
        }
        break;
      }
      case 'line': {
        // 使用 CreateLine 命令，复用实例以支持两次点击完成
        let cmd = (session as any).lineCmd as CreateLine | undefined;
        if (!cmd) (session as any).lineCmd = cmd = new CreateLine(app, manager);
        cmd.onMove?.(intersect);
        cmd.onClick(intersect);
        if (cmd.isFinished?.()) {
          cmd.finish?.();
          (session as any).lineCmd = null;
        }
        break;
      }
      case 'arc': {    
        const mode = session.arcMode ?? 'threePoints';
        let cmd = (session as any).arcCmd as CreateArc | undefined;

        // 模式变更或未创建则重建，否则复用
        if (!cmd || (cmd as any).mode !== mode) {
          (session as any).arcCmd = cmd = new CreateArc(app, manager, mode);
        }

        cmd.onMove?.(intersect);
        cmd.onClick(intersect);

        if (cmd.isFinished?.()) {
          cmd.finish?.();
          (session as any).arcCmd = null;
        }
        break;
      }
      case 'circle': {
        // 复用命令实例：用法向向量对比，避免每次点击重建导致 points 始终为 1
        const rawMode = session.circleMode ?? 'two-point'; // 与 CircleItem 当前实现一致
        const planeNormal: THREE.Vector3 =
          (session.currentSketchPlane?.normal as THREE.Vector3) ?? new THREE.Vector3(0, 0, 1);
        let cmd = (session as any).circleCmd as CreateCircle | undefined;
        if (
          !cmd ||
          (cmd as any).mode !== rawMode ||
          !(cmd as any).planeNormal?.equals?.(planeNormal)
        ) {
          (session as any).circleCmd = cmd = new CreateCircle(app, manager, rawMode, planeNormal);
        }
        cmd.onMove?.(intersect);
        cmd.onClick(intersect);
        if (cmd.isFinished?.()) {
          cmd.finish?.();
          (session as any).circleCmd = null;
        }
        break;
      }
      case 'rect': {
        RectItem.handleRectTool(app, manager, intersect, session.rectMode, session.currentSketchPlane);

      }
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
