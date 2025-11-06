// bindCancelContinuous.ts
// 绑定右键和 ESC/Enter 处理：取消或确认当前样条
import { SplineCurveItem } from '../../../geometry/sketchs/SplineCurveItem';

export function bindCancelContinuous(app: any, manager: any, session: any) {
  // 右键取消预览
  app.renderer.domElement.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    if (!session.isSketching.value) return;
    if (session.currentTool !== 'spline') return;
    if (!(manager.previewItem instanceof SplineCurveItem)) return;
    SplineCurveItem.handleSplineTool(app, manager, null, 'cancel');
  }, false);

  // 键盘：Enter 确认落地；Esc 取消预览
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!session.isSketching.value) return;
    if (session.currentTool !== 'spline') return;
    if (!(manager.previewItem instanceof SplineCurveItem)) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      SplineCurveItem.handleSplineTool(app, manager, null, 'finish');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      SplineCurveItem.handleSplineTool(app, manager, null, 'cancel');
    }
  }, false);
}
