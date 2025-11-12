import { MouseEventBase } from '../MouseEventBase';

/**
 * 对话框拖拽事件：拆分为三个事件类并继承 MouseEventBase，
 * 以便由 EventManager.this.events 管理（registerAll / bindAll / unbindAll）。
 *
 * 外部触发入口（标题栏 mousedown）：
 *   window.dispatchEvent(new CustomEvent('dialog-mousedown', { detail: { dialogEl, event } }))
 *
 * 设计保持与原先逻辑一致：mousedown 启动后由本类注册原生 mousemove/mouseup，
 * 在原生事件中转发自定义 dialog-mousemove / dialog-mouseup，mousemove 事件由 DialogMouseMoveEvent 消费并更新位置，
 * mouseup 结束并清理状态。
 */

/** 共享拖拽状态（跨类共享） */
type DragState = {
  el: HTMLElement;
  offsetX: number;
  offsetY: number;
} | null;

let draggingState: DragState = null;

type DialogEventDetail = {
  dialogEl: HTMLElement;
  event: MouseEvent;
};

/** dialog-mousedown: 开始拖拽 */
export class DialogMouseDownEvent extends MouseEventBase {
  protected eventType(): string {
    return 'dialog-mousedown';
  }

  protected handleEvent(e: MouseEvent): void {
    // Some managers may call this method with the native/Custom event.
    // Normalize and forward to the internal handler.
    this.handleDown(e as unknown as CustomEvent<DialogEventDetail>);
  }

  private onDown: EventListener = (e: Event) => this.handleDown(e as CustomEvent<DialogEventDetail>);

  // 原生绑定引用，便于后续移除
  private nativeMoveHandler = (ev: MouseEvent) => this.handleNativeMove(ev);
  private nativeUpHandler = (ev: MouseEvent) => this.handleNativeUp(ev);

  constructor(app: any, manager: any, session: any) {
    super(app, manager, session);
  }

  bind(): void {
    window.addEventListener('dialog-mousedown', this.onDown);
  }

  unbind(): void {
    window.removeEventListener('dialog-mousedown', this.onDown);
    // 兜底移除原生监听
    window.removeEventListener('mousemove', this.nativeMoveHandler);
    window.removeEventListener('mouseup', this.nativeUpHandler);
    const renderer = (this.app as any)?.renderer;
    if (renderer?.domElement) {
      renderer.domElement.removeEventListener('mousemove', this.nativeMoveHandler);
      renderer.domElement.removeEventListener('mouseup', this.nativeUpHandler);
    }
  }

  private handleDown(e: CustomEvent<DialogEventDetail>) {
    const dialogEl = e.detail?.dialogEl;
    const ev = e.detail?.event;
    if (!dialogEl || !ev) return;
    if (ev.button !== 0) return; // 仅响应左键
    ev.preventDefault();

    const rect = dialogEl.getBoundingClientRect();
    draggingState = {
      el: dialogEl,
      offsetX: ev.clientX - rect.left,
      offsetY: ev.clientY - rect.top,
    };

    // 绑定原生 mousemove / mouseup，将原生事件转为自定义事件（dialog-mousemove / dialog-mouseup）
    window.addEventListener('mousemove', this.nativeMoveHandler, { passive: false });
    window.addEventListener('mouseup', this.nativeUpHandler, { passive: true });

    const renderer = (this.app as any)?.renderer;
    if (renderer?.domElement) {
      renderer.domElement.addEventListener('mousemove', this.nativeMoveHandler, { passive: false });
      renderer.domElement.addEventListener('mouseup', this.nativeUpHandler, { passive: true });
    }
  }

  private handleNativeMove(ev: MouseEvent) {
    if (!draggingState) return;
    // 转发为自定义事件，由 DialogMouseMoveEvent 处理
    window.dispatchEvent(new CustomEvent('dialog-mousemove', { detail: { dialogEl: draggingState.el, event: ev } }));
  }

  private handleNativeUp(ev: MouseEvent) {
    if (!draggingState) return;
    // 转发为自定义事件，由 DialogMouseUpEvent 处理
    window.dispatchEvent(new CustomEvent('dialog-mouseup', { detail: { dialogEl: draggingState.el, event: ev } }));

    // 解绑原生监听
    window.removeEventListener('mousemove', this.nativeMoveHandler);
    window.removeEventListener('mouseup', this.nativeUpHandler);
    const renderer = (this.app as any)?.renderer;
    if (renderer?.domElement) {
      renderer.domElement.removeEventListener('mousemove', this.nativeMoveHandler);
      renderer.domElement.removeEventListener('mouseup', this.nativeUpHandler);
    }
  }
}

/** dialog-mousemove: 更新对话框位置 */
export class DialogMouseMoveEvent extends MouseEventBase {
  protected eventType(): string {
    return 'dialog-mousemove';
  }

  protected handleEvent(e: MouseEvent): void {
    // Some managers may call this method with the native/Custom event.
    // Normalize and forward to the internal handler.
    this.handleMove(e as unknown as CustomEvent<DialogEventDetail>);
  }

  private onMove: EventListener = (e: Event) => this.handleMove(e as CustomEvent<DialogEventDetail>);

  constructor(app: any, manager: any, session: any) {
    super(app, manager, session);
  }

  bind(): void {
    window.addEventListener('dialog-mousemove', this.onMove);
  }

  unbind(): void {
    window.removeEventListener('dialog-mousemove', this.onMove);
  }

  private handleMove(e: CustomEvent<DialogEventDetail>) {
    if (!draggingState) return;
    const ev = e.detail?.event;
    if (!ev) return;
    ev.preventDefault();

    const el = draggingState.el;
    const dialogRect = el.getBoundingClientRect();
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    let x = ev.clientX - draggingState.offsetX;
    let y = ev.clientY - draggingState.offsetY;

    x = Math.max(0, Math.min(x, screenW - dialogRect.width));
    y = Math.max(0, Math.min(y, screenH - dialogRect.height));

    el.style.position = 'fixed';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  }
}

/** dialog-mouseup: 结束拖拽并清理状态 */
export class DialogMouseUpEvent extends MouseEventBase {
  protected eventType(): string {
    return 'dialog-mouseup';
  }

  protected handleEvent(e: MouseEvent): void {
    // Normalize native/Custom event and forward to internal handler
    this.handleUp(e as unknown as CustomEvent<DialogEventDetail>);
  }

  private onUp: EventListener = (e: Event) => this.handleUp(e as CustomEvent<DialogEventDetail>);

  constructor(app: any, manager: any, session: any) {
    super(app, manager, session);
  }

  bind(): void {
    window.addEventListener('dialog-mouseup', this.onUp);
  }

  unbind(): void {
    window.removeEventListener('dialog-mouseup', this.onUp);
  }

  private handleUp(e: CustomEvent<DialogEventDetail>) {
    const ev = e.detail?.event;
    // If there's no related event or it's not a left-button release, ignore.
    if (!ev || ev.button !== 0) return;

    // Prevent default behavior for the synthetic handling.
    try { ev.preventDefault(); } catch {}

    // Clear shared dragging state to end dragging.
    draggingState = null;
  }
}

/** 便捷管理器：对话框标题栏 mousedown 时调用 */
export class DialogMouseEventManager {
  private static instance: DialogMouseEventManager | null = null;

  static getInstance() {
    if (!DialogMouseEventManager.instance) {
      DialogMouseEventManager.instance = new DialogMouseEventManager();
    }
    return DialogMouseEventManager.instance;
  }

  /** 启动对话框拖拽（标题栏 mousedown 时调用） */
  public registerDialogDrag(dialogEl: HTMLElement, startEvent: MouseEvent) {
    window.dispatchEvent(new CustomEvent('dialog-mousedown', { detail: { dialogEl, event: startEvent } }));
  }
}



