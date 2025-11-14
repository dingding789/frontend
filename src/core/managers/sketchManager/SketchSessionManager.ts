import * as THREE from 'three';
import { SketchTool } from './SketchManager';
import { ref } from 'vue';
import { RectItem } from '../../geometry/sketchs/RectItem';
import { EventManager } from '../eventManager/EventManager';

export class SketchSessionManager {
  public isSketching = ref(false);
  public mouse = new THREE.Vector2();
  public raycaster = new THREE.Raycaster();
  public currentSketchPlane: THREE.Plane | null = null;
  public currentTool: SketchTool | null = null;

  // UI：'two-point' | 'three-point'
  public rectMode: 'two-point' | 'three-point' = 'two-point';
  public circleMode: 'two-point' | 'three-point' = 'two-point';
  public arcMode: 'threePoints' | 'centerStartEnd' = 'threePoints';
  public SpineCurveMode: 'passPoint' | 'dependencePoint' = 'passPoint';

  private canvas: HTMLElement | Window;

  constructor(private app: any, private manager: any) {
    // 确保 previewItem 字段存在（与样条保持一致）
    if (this.manager && typeof this.manager === 'object' && !('previewItem' in this.manager)) {
      (this.manager as any).previewItem = null;
    }

    this.canvas = (this.app as any)?.renderer?.domElement ?? window;

    // 绑定到原始 EventManager（优先），并回退原生事件
    const EM: any = (EventManager as any)?.getInstance?.() ?? EventManager;
    const moveHandler = (e: any) => this.onPointerMoveFromEvent(e);
    const downHandler = (e: any) => this.onPointerDownFromEvent(e);

    EM?.on?.('sketch:pointermove', moveHandler);
    EM?.on?.('sketch:pointerdown', downHandler);
    EM?.addEventListener?.('sketch:pointermove', moveHandler);
    EM?.addEventListener?.('sketch:pointerdown', downHandler);

    this.canvas.addEventListener?.('pointermove', (e: PointerEvent) => this.onPointerMoveFromEvent(e));
    this.canvas.addEventListener?.('pointerdown', (e: PointerEvent) => this.onPointerDownFromEvent(e));

    // 监听矩形模式切换（双通道）
    const rectModeListener = (payload: any) => {
      const mode = (payload?.detail?.mode ?? payload?.mode) as string | undefined;
      if (!mode) return;
      this.rectMode = (mode === 'three-point' || mode === 'threePoint') ? 'three-point' : 'two-point';
      this.currentTool = 'rect';
      try { (this.manager as any).currentTool = 'rect'; } catch {}
      // 切模式清理预览
      try { (this.manager as any).previewItem?.remove?.(this.app.scene); (this.manager as any).previewItem = null; } catch {}
    };
    EM?.on?.('sketch:rect-mode-changed', rectModeListener);
    EM?.addEventListener?.('sketch:rect-mode-changed', rectModeListener);
    window.addEventListener('sketch:rect-mode-changed', (e: Event) => rectModeListener(e as CustomEvent));
    window.addEventListener('dialog:rect-mode-select', (e: Event) => rectModeListener(e as CustomEvent));
  }

  setTool(tool: SketchTool) {
    this.currentTool = tool;
    try { this.manager.previewItem = null; } catch {}
  }
  setRectMode(mode: 'two-point' | 'three-point') { this.rectMode = mode; }
  setCircleMode(mode: 'two-point' | 'three-point') { this.circleMode = mode; }
  setArcMode(mode: 'threePoints' | 'centerStartEnd') { this.arcMode = mode; }
  setSplineMode(mode: 'passPoint' | 'dependencePoint') { this.SpineCurveMode = mode; }

  private parseClientXY(e: any): { x: number; y: number; button: number } | null {
    if (!e) return null;
    if (e.clientX != null && e.clientY != null) return { x: e.clientX, y: e.clientY, button: e.button ?? 0 };
    const d = (e as CustomEvent)?.detail;
    if (d?.clientX != null && d?.clientY != null) return { x: d.clientX, y: d.clientY, button: d.button ?? 0 };
    return null;
  }

  private rayToPlane(clientX: number, clientY: number): THREE.Vector3 | null {
    const canvas = (this.app as any)?.renderer?.domElement as HTMLElement | undefined;
    const rect = canvas?.getBoundingClientRect();
    const nx = rect ? ((clientX - rect.left) / rect.width) * 2 - 1 : (clientX / window.innerWidth) * 2 - 1;
    const ny = rect ? -((clientY - rect.top) / rect.height) * 2 + 1 : -(clientY / window.innerHeight) * 2 + 1;
    this.mouse.set(nx, ny);
    const plane = this.currentSketchPlane ?? new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.raycaster.setFromCamera(this.mouse, this.app.camera);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(plane, p) ? p : null;
  }

  private toolIsRect(): boolean {
    return this.currentTool === 'rect' || this.manager?.currentTool === 'rect' || this.manager?.sketchSession?.currentTool === 'rect';
  }

  // EventManager/native -> 预览
  private onPointerMoveFromEvent(e: any) {
    if (!this.toolIsRect()) return;
    const xy = this.parseClientXY(e);
    if (!xy) return;
    const hit = this.rayToPlane(xy.x, xy.y);
    if (!hit) return;

    const preview = (this.manager as any)?.previewItem;
    if (preview && typeof preview.drawPreview === 'function') {
      preview.drawPreview(this.app.scene, hit.clone());
      this.app.renderOnce?.();
    }
  }

  // EventManager/native -> 创建/推进
  private onPointerDownFromEvent(e: any) {
    const xy = this.parseClientXY(e);
    if (!xy || xy.button !== 0) return;
    if (!this.toolIsRect()) return;

    const hit = this.rayToPlane(xy.x, xy.y);
    if (!hit) return;

    const modeInternal: 'twoPoint' | 'threePoint' = this.rectMode === 'three-point' ? 'threePoint' : 'twoPoint';
    try {
      RectItem.handleRectTool(this.app, this.manager, hit.clone(), modeInternal, this.currentSketchPlane ?? undefined);
      this.app.renderOnce?.();
    } catch (err) {
      console.error('[SketchSession] rect handle error:', err);
    }
  }
}
