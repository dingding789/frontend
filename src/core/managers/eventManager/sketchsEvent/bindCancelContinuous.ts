// bindCancelContinuous.ts
// 绑定右键和ESC取消草图预览事件
/**
 * 绑定取消连续绘制（右键/ESC）事件
 * @param app 应用管理器
 * @param manager 草图管理器
 * @param session 草图会话状态
 */
export function bindCancelContinuous(app: any, manager: any, session: any) {
  // 右键取消预览
  app.renderer.domElement.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    manager.previewItem?.remove(app.scene);
    manager.previewItem = null;
  });

  // 键盘ESC取消预览
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      manager.previewItem?.remove(app.scene);
      manager.previewItem = null;
    }
  });
}
