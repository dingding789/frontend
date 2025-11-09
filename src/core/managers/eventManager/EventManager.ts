
import { MouseEventBase } from './MouseEventBase';
import { SketchClickEvent } from './sketchsEvent/SketchClickEvent';
import { MouseMoveEvent, MouseDownEvent, MouseUpEvent, MouseDoubleClickEvent } from './sketchsEvent/MouseMoveEvent';
import { KeydownEvent } from './sketchsEvent/KeydownEvent';
import { KeyboardEventBase } from './KeyboardEventBase';
export class EventManager {
  private app: any;
  private session: any;
  private manager: any;

  private events: Map<string, MouseEventBase | KeyboardEventBase> = new Map();



  constructor(app: any, manager: any, session: any) {
    this.app = app;
    this.manager = manager;
    this.session = session;
  }

  /** 注册所有鼠标事件 */
  public registerAll() {
    const common = { app: this.app, manager: this.manager, session: this.session };


    this.events.set('move', new MouseMoveEvent(common.app, common.manager, common.session));
    this.events.set('down', new MouseDownEvent(common.app, common.manager, common.session));
    this.events.set('up', new MouseUpEvent(common.app, common.manager, common.session));
    this.events.set('click', new SketchClickEvent(common.app, common.manager, common.session));
    this.events.set('keydown', new KeydownEvent(common.app, common.manager, common.session));
  }

  /** 绑定所有事件 */
  public bindAll() {
    this.events.forEach((ev) => ev.bind());
  }

  /** 解绑所有事件 */
  public unbindAll() {
    this.events.forEach((ev) => ev.unbind());
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
