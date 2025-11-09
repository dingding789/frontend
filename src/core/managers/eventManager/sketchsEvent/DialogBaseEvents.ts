import AppManager from "../../sketchManager/SketchManager";

export class DialogMouseEventManager {
  private static instance: DialogMouseEventManager | null = null;
  private draggingDialog: HTMLElement | null = null;
  private dragOffset = { x: 0, y: 0 };

  // 将这些处理器改为可能为 undefined，避免后续使用非空断言导致飘红
  public onMouseMove?: (e: MouseEvent) => void;
  public onMouseUp?: (e: MouseEvent) => void;
  public onMouseDown?: (e: MouseEvent) => void;

  private app?: AppManager;
  constructor(app?: AppManager) {
    this.app = app;
  }

  static getInstance(app?: AppManager) {
    if (!DialogMouseEventManager.instance) {
      DialogMouseEventManager.instance = new DialogMouseEventManager(app);
    }
    return DialogMouseEventManager.instance;
  }

  registerDialogDrag(dialogEl: HTMLElement, startEvent: MouseEvent) {
    this.draggingDialog = dialogEl;
    const rect = dialogEl.getBoundingClientRect();
    this.dragOffset = {
      x: startEvent.clientX - rect.left,
      y: startEvent.clientY - rect.top,
    };

    // 绑定并保存具体函数引用，后面移除时使用相同引用
    this.onMouseMove = this.handleMouseMove.bind(this);
    this.onMouseUp = this.handleMouseUp.bind(this);
    this.onMouseDown = this.handleMouseDown.bind(this);

    if (this.onMouseMove) window.addEventListener('mousemove', this.onMouseMove);
    if (this.onMouseUp) window.addEventListener('mouseup', this.onMouseUp);
    if (this.onMouseDown) window.addEventListener('mousedown', this.onMouseDown);

    // 如果 app 存在且有 renderer.domElement，可以额外监听
    const renderer = (this.app as any)?.renderer;
    if (renderer && renderer.domElement) {
      if (this.onMouseMove) renderer.domElement.addEventListener('mousemove', this.onMouseMove);
      if (this.onMouseDown) renderer.domElement.addEventListener('mousedown', this.onMouseDown);
      if (this.onMouseUp) renderer.domElement.addEventListener('mouseup', this.onMouseUp);
    }
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.draggingDialog) return;
    const dialog = this.draggingDialog;
    const dialogRect = dialog.getBoundingClientRect();
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    let x = e.clientX - this.dragOffset.x;
    let y = e.clientY - this.dragOffset.y;
    x = Math.max(0, Math.min(x, screenW - dialogRect.width));
    y = Math.max(0, Math.min(y, screenH - dialogRect.height));
    dialog.style.left = x + 'px';
    dialog.style.top = y + 'px';
    dialog.style.right = 'auto';
    dialog.style.bottom = 'auto';
  }

  private handleMouseUp(e: MouseEvent) {
    // 停止拖拽并移除监听
    this.draggingDialog = null;
    if (this.onMouseMove) {
      window.removeEventListener('mousemove', this.onMouseMove);
      const renderer = (this.app as any)?.renderer;
      if (renderer && renderer.domElement) {
        renderer.domElement.removeEventListener('mousemove', this.onMouseMove);
      }
    }
    if (this.onMouseUp) {
      window.removeEventListener('mouseup', this.onMouseUp);
      const renderer = (this.app as any)?.renderer;
      if (renderer && renderer.domElement) {
        renderer.domElement.removeEventListener('mouseup', this.onMouseUp);
      }
    }
    if (this.onMouseDown) {
      window.removeEventListener('mousedown', this.onMouseDown);
      const renderer = (this.app as any)?.renderer;
      if (renderer && renderer.domElement) {
        renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
      }
    }

    // 清理引用
    this.onMouseMove = undefined;
    this.onMouseUp = undefined;
    this.onMouseDown = undefined;
  }

  private handleMouseDown(e: MouseEvent) {
    // 可扩展：当前保持空实现
  }
}



