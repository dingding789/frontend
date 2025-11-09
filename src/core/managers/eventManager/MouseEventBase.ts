/**
 * 鼠标事件基类，负责事件绑定和解绑
 */
export abstract class MouseEventBase {
  protected app: any;
  protected manager: any;
  protected session: any;
  private handler: (e: MouseEvent) => void;

  constructor(app: any, manager: any, session: any) {
    this.app = app;
    this.manager = manager;
    this.session = session;
    this.handler = this.handleEvent.bind(this);
  }

  /** 返回事件类型，如 'click' 或 'mousemove' */
  protected abstract eventType(): string;

  /** 事件处理方法，子类需实现具体逻辑 */
  protected abstract handleEvent(e: MouseEvent): void;
  

  /** 绑定事件 */
  public bind() {
    this.app.renderer.domElement.addEventListener(this.eventType(), this.handler, false);
  }

  /** 解绑事件 */
  public unbind() {
    this.app.renderer.domElement.removeEventListener(this.eventType(), this.handler, false);
  }
}