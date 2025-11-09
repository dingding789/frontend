// KeydownEvent.ts
import { KeyboardEventBase } from '../KeyboardEventBase';
import { SplineCurveItem } from '../../../geometry/sketchs/SplineCurveItem';

/**
 * 键盘 Enter / Esc 处理连续绘制确认与取消
 */
export class KeydownEvent extends KeyboardEventBase {
  protected eventType(): string {
    return 'keydown';
  }

  protected handleEvent(e: KeyboardEvent): void {
    const { app, manager, session } = this;

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
  }
}
