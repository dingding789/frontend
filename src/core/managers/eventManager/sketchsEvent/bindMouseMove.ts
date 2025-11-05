// bindMouseMove.ts
// 绑定草图绘制预览的鼠标移动事件
import * as THREE from 'three';

/**
 * 绑定鼠标移动事件，实现绘制预览效果
 * @param app 应用管理器
 * @param manager 草图管理器
 * @param session 草图会话状态
 */
export function bindMouseMove(app: any, manager: any, session: any) {
  app.renderer.domElement.addEventListener('mousemove', (e: MouseEvent) => {
    // 非绘制状态或未选择工具/平面时不处理
    if (!session.isSketching.value || !session.currentTool || !session.currentSketchPlane) return;
    // 计算鼠标在画布上的归一化坐标
    const rect = app.renderer.domElement.getBoundingClientRect();
    session.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    session.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    session.raycaster.setFromCamera(session.mouse, app.camera);

    // 获取与平面交点
    const intersect = new THREE.Vector3();
    const ok = session.raycaster.ray.intersectPlane(session.currentSketchPlane, intersect);
    if (!ok) return;

    // 调用预览对象的drawPreview方法进行预览渲染
    const preview = manager.previewItem;
    if (preview?.drawPreview) {
      preview.drawPreview(app.scene, intersect);
      app.renderOnce();
    }
  });
}
