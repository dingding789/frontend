import * as THREE from 'three';
import { SketchManager } from './SketchManager';

export class SketchHideManager {
  private sketchMgr: SketchManager;
  private hiddenIds = new Set<string>();

  constructor(sketchMgr: SketchManager) {
    this.sketchMgr = sketchMgr;
  }

  /** 判断是否已隐藏 */
  isHidden(id: number | string): boolean {
    return this.hiddenIds.has(String(id));
  }

  /** 隐藏指定草图（及其所有 items） */
  hideById(id: number | string) {
    const sid = String(id);
    const group = this.findGroup(sid);
    if (!group) return;
    group.items?.forEach((it: any) => {
      const obj = it?.object3D as THREE.Object3D | undefined;
      if (obj) obj.visible = false;
    });
    this.hiddenIds.add(sid);
    this.sketchMgr.app.renderOnce?.();
  }

  /** 显示指定草图 */
  showById(id: number | string) {
    const sid = String(id);
    const group = this.findGroup(sid);
    if (!group) return;
    group.items?.forEach((it: any) => {
      const obj = it?.object3D as THREE.Object3D | undefined;
      if (obj) obj.visible = true;
    });
    this.hiddenIds.delete(sid);
    this.sketchMgr.app.renderOnce?.();
  }

  /** 切换隐藏/显示 */
  toggleById(id: number | string) {
    this.isHidden(id) ? this.showById(id) : this.hideById(id);
  }

  /** 仅保留指定草图，其余全部隐藏 */
  hideExcept(id: number | string) {
    const target = String(id);
    const groups = this.sketchMgr.allSketch || [];
    groups.forEach(g => {
      const gid = String((g as any).id ?? g.items?.[0]?.id ?? g.items?.[0]?.object3D?.userData?.sketchItem?.id);
      if (gid === target) {
        g.items?.forEach((it: any) => { const o = it?.object3D; if (o) o.visible = true; });
        this.hiddenIds.delete(gid);
      } else {
        g.items?.forEach((it: any) => { const o = it?.object3D; if (o) o.visible = false; });
        this.hiddenIds.add(gid);
      }
    });
    this.sketchMgr.app.renderOnce?.();
  }

  /** 显示全部草图 */
  showAll() {
    const groups = this.sketchMgr.allSketch || [];
    groups.forEach(g => g.items?.forEach((it: any) => {
      const o = it?.object3D; if (o) o.visible = true;
    }));
    this.hiddenIds.clear();
    this.sketchMgr.app.renderOnce?.();
  }

  private findGroup(id: string) {
    return (this.sketchMgr.allSketch || []).find((g: any) =>
      String(g?.id) === id ||
      String(g?.items?.[0]?.id) === id ||
      String(g?.items?.[0]?.object3D?.userData?.sketchItem?.id) === id
    );
  }
}