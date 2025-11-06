// bindEvents.ts
// 绑定草图绘制相关的鼠标点击事件
import * as THREE from 'three';
import { SketchPlaneName } from '../../sketchManager/SketchManager';
import { ArcItem, CircleItem, LineItem, PointItem, RectItem, SketchItem } from '../../../../core/geometry/sketchs';
import { SplineCurveItem } from '../../../geometry/sketchs/SplineCurveItem';

/**
 * 绑定草图绘制相关事件（点击）
 * @param app 应用管理器
 * @param manager 草图管理器
 * @param session 草图会话状态
 */
export function bindEvents(app: any, manager: any, session: any) {
  // 鼠标点击事件
  app.renderer.domElement.addEventListener('click', (e: MouseEvent) => {
    // 非绘制状态直接返回
    if (!session.isSketching.value) return;

    // 拖拽刚结束时，抑制一次 click 生成新点
    if (session.suppressNextClick) {
      session.suppressNextClick = false;
      return;
    }

    // 计算鼠标在画布上的归一化坐标
    const rect = app.renderer.domElement.getBoundingClientRect();
    session.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    session.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    session.raycaster.setFromCamera(session.mouse, app.camera);

    // 平面选择逻辑：首次点击选择绘图平面
    if (!session.currentSketchPlane) {
      let meshes: THREE.Object3D[] = [];
      if (typeof manager.planeMgr.getMeshes === 'function') {
        meshes = manager.planeMgr.getMeshes();
      } else if (manager.planeMgr.planes) {
        meshes = manager.planeMgr.planes.map((p: any) => p.mesh);
      }
      const intersects = session.raycaster.intersectObjects(meshes);
      if (intersects.length > 0) {
        const planeName = intersects[0].object.name as SketchPlaneName;
        // 选中平面并高亮
        const plane = manager.planeMgr.selectPlane?.(planeName) ?? manager.planeMgr.getCurrentTHREEPlane?.();
        if (plane instanceof THREE.Plane) session.currentSketchPlane = plane;
        manager.planeMgr.highlightPlane?.(planeName);
        manager.planeMgr.removeAll();
      }
      return;
    }

    // 获取与平面交点
    const intersect = new THREE.Vector3();
    const ok = session.raycaster.ray.intersectPlane(session.currentSketchPlane, intersect);
    if (!ok) return;

    // 根据当前工具类型分发到对应绘制逻辑
    switch (session.currentTool) {
      case 'spline':
        // 点击连续加点；首点仅创建 previewItem，不立即预览
        SplineCurveItem.handleSplineTool(app, manager, intersect, 'add');
        break;
      case 'point':
        PointItem.handlePointTool(app, manager, intersect);
        break;
      case 'line':
        LineItem.handleLineTool(app, manager, intersect);
        break;
      case 'arc':
        ArcItem.handleArcTool(app, manager, intersect, session.arcMode, session.currentSketchPlane);
        break;
      case 'circle':
        CircleItem.handleCircleTool(app, manager, intersect, session.circleMode, session.currentSketchPlane);
        break;
      case 'rect':
        RectItem.handleRectTool(app, manager, intersect, session.rectMode, session.currentSketchPlane);
        break;
    }
    app.renderOnce();
  }, false);
}
