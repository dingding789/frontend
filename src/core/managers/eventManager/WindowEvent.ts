/**
 * WindowEvent
 * 继承 MouseEventBase，用于管理与窗口相关的全局事件（resize / keydown / keyup）
 * 该类重写 bind/unbind，将监听器注册到 window 上，并在 resize 时触发场景重渲染标记
 */
import { MouseEventBase } from './MouseEventBase';
import * as THREE from 'three';
export class WindowEvent extends MouseEventBase {
  protected eventType(): string { return 'window-event'; }
  protected handleEvent(_e: MouseEvent): void { /* not used */ }

  private resizeHandler = () => {
    if (!this.app) return;
    this.app.camera.aspect = window.innerWidth / window.innerHeight;
    this.app.camera.updateProjectionMatrix();
    this.app.renderer.setSize(window.innerWidth, window.innerHeight);
    // 标记需要渲染（供 animate 循环使用）
    if (typeof this.app.needsRender !== 'undefined') this.app.needsRender = true;
  };

  private keyDownHandler = (ev: KeyboardEvent) => {
    if (!this.app) return;
    if (ev.key === 'Shift') {
      // controls.instance 来自 SceneControls
      try {
        this.app.controls.instance.mouseButtons.MIDDLE = (THREE as any).MOUSE.PAN;
      } catch (err) {
        // ignore if controls shape differs
      }
    }
  };

  private keyUpHandler = (ev: KeyboardEvent) => {
    if (!this.app) return;
    if (ev.key === 'Shift') {
      try {
        this.app.controls.instance.mouseButtons.MIDDLE = (THREE as any).MOUSE.ROTATE;
      } catch (err) {
        // ignore
      }
    }
  };

  constructor(app: any, manager?: any, session?: any) {
    super(app, manager, session);
  }

  // 覆盖 bind，将监听器绑定到 window
  public bind(): void {
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('keydown', this.keyDownHandler);
    window.addEventListener('keyup', this.keyUpHandler);
  }

  // 覆盖 unbind，移除 window 监听
  public unbind(): void {
    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('keydown', this.keyDownHandler);
    window.removeEventListener('keyup', this.keyUpHandler);
  }
}