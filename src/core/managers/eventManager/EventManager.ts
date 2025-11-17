import { MouseEventBase } from './MouseEventBase';
import { SketchClickEvent } from './sketchsEvent/SketchClickEvent';
import { SketchMouseMove, SketchMouseDown, SketchMouseUp, SketchMouseDoubleClick } from './sketchsEvent/SketchMouseMove';
import { KeydownEvent } from './sketchsEvent/KeydownEvent';
import { KeyboardEventBase } from './KeyboardEventBase';
import { WindowEvent } from './WindowEvent';
import { ExtrudePicker } from './featuresEvent/ExtrudeEvents';
// 对话框拖拽事件
import { DialogMouseDownEvent, DialogMouseMoveEvent, DialogMouseUpEvent } from './sketchsEvent/DialogBaseEvents';

/**
 * LazyEvent：延迟实例化包装器
 * registerAll 时把所有事件 "注册" 在一起，但只有在 bind 时才真正 new 对应类，
 * 可避免在构造阶段触发某些事件类（如继承自 MouseEventBase）内部访问尚未准备好的上下文导致的错误。
 */
class LazyEvent {
  private instance: any = null;
  constructor(private Ctor: any, private args: any[]) {}
  bind() {
    if (!this.instance) {
      this.instance = new this.Ctor(...this.args);
    }
    if (typeof this.instance.bind === 'function') {
      this.instance.bind();
    }
  }
  unbind() {
    if (this.instance && typeof this.instance.unbind === 'function') {
      this.instance.unbind();
    }
  }
}

export class EventManager {
  private app: any;
  private session: any;
  private manager: any;

  // 事件集合，所有事件类都实现 bind()/unbind()
  // 保持类型为基类以兼容所有事件实现
  private events: Map<string, MouseEventBase | KeyboardEventBase | { bind(): void; unbind(): void }> = new Map();

  constructor(app: any, manager: any, session: any) {
    this.app = app;
    this.manager = manager;
    this.session = session;
  }

  /**
   * 注册所有事件（在此处统一注册，避免分散逻辑）。
   * 对可能在构造期访问未就绪上下文的类，使用 LazyEvent 延迟到 bind 时实例化。
   */
  public registerAll() {
    const common = { app: this.app, manager: this.manager, session: this.session };
    this.events.set('pointerdown', new LazyEvent(ExtrudePicker, [common.app, common.manager, common.session]));

    // 直接实例化的事件（通常安全）
    this.events.set('move', new LazyEvent(SketchMouseMove, [common.app, common.manager, common.session]));
    this.events.set('down', new LazyEvent(SketchMouseDown, [common.app, common.manager, common.session]));
    this.events.set('up', new LazyEvent(SketchMouseUp, [common.app, common.manager, common.session]));
    this.events.set('click', new LazyEvent(SketchClickEvent, [common.app, common.manager, common.session]));
    this.events.set('keydown', new LazyEvent(KeydownEvent, [common.app, common.manager, common.session]));
    this.events.set('window-event', new LazyEvent(WindowEvent, [common.app, common.manager, common.session]));
  
    // 立即“注册”对话框相关事件，但延迟实例化以避免构造期错误
    this.events.set('dialog-mousedown', new LazyEvent(DialogMouseDownEvent, [common.app, common.manager, common.session]));
    this.events.set('dialog-mousemove', new LazyEvent(DialogMouseMoveEvent, [common.app, common.manager, common.session]));
    this.events.set('dialog-mouseup', new LazyEvent(DialogMouseUpEvent, [common.app, common.manager, common.session]));
      }

  /** 绑定所有事件（此处会触发 LazyEvent 的真实实例化并 bind） */
  public bindAll() {
    this.events.forEach((ev) => {
      try {
        ev.bind();
      } catch (err) {
        console.error('[EventManager] event bind error:', err);
      }
    });
  }

  /** 解绑所有事件 */
  public unbindAll() {
    this.events.forEach((ev) => {
      try {
        ev.unbind();
      } catch (err) {
        console.error('[EventManager] event unbind error:', err);
      }
    });
  }

  /** 启用某个事件 */
  public enable(name: string) {
    this.events.get(name)?.bind();
  }

  /** 禁用某个事件 */
  public disable(name: string) {
    this.events.get(name)?.unbind();
  }
}
