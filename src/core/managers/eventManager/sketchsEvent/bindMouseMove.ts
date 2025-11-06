// bindMouseMove.ts
// 绑定草图绘制预览和样条句柄拖拽
import * as THREE from 'three';
import { SplineCurveItem } from '../../../geometry/sketchs/SplineCurveItem';

/**
  * 绑定草图绘制相关事件（鼠标移动）
  * @param app 应用管理器
  * @param manager 草图管理器
  * @param session 草图会话状态 
*/

export function bindMouseMove(app: any, manager: any, session: any) {
  const dom = app.renderer.domElement as HTMLElement;

  dom.addEventListener('mousemove', (e: MouseEvent) => {
    if (!session.isSketching.value) return;

    // 更新射线
    const rect = dom.getBoundingClientRect();
    session.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    session.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    session.raycaster.setFromCamera(session.mouse, app.camera);

    // 拖拽已落地样条的控制点
    if (session.splineDrag && session.currentSketchPlane) {
      const hit = new THREE.Vector3();
      if (session.raycaster.ray.intersectPlane(session.currentSketchPlane, hit)) {
        session.splineDrag.item.setPoint(session.splineDrag.index, hit, app.scene);
        app.renderOnce();
      }
      return;
    }

    // 无平面不预览
    if (!session.currentSketchPlane) return;

    // 求交
    const intersect = new THREE.Vector3();
    const ok = session.raycaster.ray.intersectPlane(session.currentSketchPlane, intersect);
    if (!ok) return;

    // 仅当当前工具为样条时，调用样条的 preview；否则不干扰其它图元的预览
    if (session.currentTool === 'spline' && manager.previewItem instanceof SplineCurveItem) {
      SplineCurveItem.handleSplineTool(app, manager, intersect, 'preview');
      return;
    }

    // 通用预览通道：若当前有 previewItem 且实现了 drawPreview，则调用它
    if (manager.previewItem && typeof manager.previewItem.drawPreview === 'function') {
      manager.previewItem.drawPreview(app.scene, intersect);
      app.renderOnce();
    }
  }, false);

  // 命中句柄开始拖拽（仅已落地样条）
  dom.addEventListener('mousedown', (e: MouseEvent) => {
    if (!session.isSketching.value) return;
    if (session.currentTool !== 'spline') return;

    const rect = dom.getBoundingClientRect();
    session.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    session.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    session.raycaster.setFromCamera(session.mouse, app.camera);

    const items = (manager.sketchItems.value || []) as any[];
    const handles: THREE.Object3D[] = [];
    for (const it of items) {
      if (it instanceof SplineCurveItem) handles.push(...it.getHandleObjects());
    }
    if (handles.length === 0) return;

    const hits = session.raycaster.intersectObjects(handles, true);
    if (hits.length > 0) {
      const info = (hits[0].object as any).userData || {};
      if (info && info.owner instanceof SplineCurveItem && typeof info.index === 'number') {
        session.splineDrag = { item: info.owner as SplineCurveItem, index: info.index as number };
        session.suppressNextClick = true; // 防止松开触发 click 新增点
      }
    }
  }, false);

  // 结束拖拽
  dom.addEventListener('mouseup', () => {
    if (session.splineDrag) session.splineDrag = null;
  }, false);

  // 双击结束当前样条（不影响其它图元）
  dom.addEventListener('dblclick', () => {
    if (!session.isSketching.value) return;
    if (session.currentTool !== 'spline') return;
    if (manager.previewItem instanceof SplineCurveItem) {
      SplineCurveItem.handleSplineTool(app, manager, null, 'finish');
    }
  }, false);
}
