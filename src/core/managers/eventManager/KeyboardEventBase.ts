// KeyboardEventBase.ts
export abstract class KeyboardEventBase {
  protected app: any;
  protected manager: any;
  protected session: any;
  private handler: (e: Event) => void;

  constructor(app: any, manager: any, session: any) {
    this.app = app;
    this.manager = manager;
    this.session = session;
    this.handler = (e: Event) => this.handleEvent(e as KeyboardEvent);
  }

  protected abstract eventType(): string;
  protected abstract handleEvent(e: KeyboardEvent): void;

  public bind() {
    window.addEventListener(this.eventType(), this.handler, false);
  }

  public unbind() {
    window.removeEventListener(this.eventType(), this.handler, false);
  }
}
