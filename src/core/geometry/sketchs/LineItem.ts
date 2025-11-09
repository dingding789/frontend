/**
 * LineItem
 * 表示草图中的线段元素，支持正式绘制和预览绘制
 * 包含序列化、反序列化、交互工具静态方法
 */

// LineItem.ts
import * as THREE from 'three';
import { SketchItem } from './SketchItem';

// 定义LineItem类，继承自SketchItem，用于表示和绘制线段
export class LineItem extends SketchItem {
  // 用于绑定“完成/取消”事件的弱映射，按 manager 维度管理
  private static _bindings = new WeakMap<any, { teardown: () => void }>();

  // 绑定完成/取消事件（右键/Enter 完成，Esc 取消）
  static enableFinishCancel(app: any, manager: any) {
    if (LineItem._bindings.has(manager)) return;

    const canvas: HTMLElement | null =
      (app?.renderer?.domElement as HTMLElement) ||
      (typeof document !== 'undefined' ? (document.querySelector('canvas') as HTMLElement | null) : null);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        LineItem.finishLineTool(app, manager);
      } else if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        e.stopPropagation();
        LineItem.cancelLineTool(app, manager);
      }
    };

    const finishByRightClick = (e: MouseEvent | PointerEvent) => {
      // 仅右键触发
      const btn = (e as MouseEvent).button;
      if (btn === 2) {
        e.preventDefault?.();
        e.stopPropagation?.();
        LineItem.finishLineTool(app, manager);
      }
    };

    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // 同时触发完成
      LineItem.finishLineTool(app, manager);
    };

    window.addEventListener('keydown', onKeyDown, true);
    if (canvas) {
      canvas.addEventListener('mousedown', finishByRightClick as EventListener, true);
      canvas.addEventListener('pointerdown', finishByRightClick as EventListener, true);
      canvas.addEventListener('contextmenu', preventContextMenu as EventListener, true);
    }

    const teardown = () => {
      window.removeEventListener('keydown', onKeyDown, true);
      if (canvas) {
        canvas.removeEventListener('mousedown', finishByRightClick as EventListener, true);
        canvas.removeEventListener('pointerdown', finishByRightClick as EventListener, true);
        canvas.removeEventListener('contextmenu', preventContextMenu as EventListener, true);
      }
    };

    LineItem._bindings.set(manager, { teardown });
  }

  // 解绑完成/取消事件
  static disableFinishCancel(manager: any) {
    const b = LineItem._bindings.get(manager);
    if (b) {
      try { b.teardown(); } catch {}
      LineItem._bindings.delete(manager);
    }
  }

  // 完成绘制：结束当前这一段的连续绘制，但保持仍在“直线”工具中
  // 需求：按下 Enter 或鼠标右键后，下一次点击可以继续绘制新的线段
  static finishLineTool(app: any, manager: any) {
    try {
      if (manager?.previewItem && manager.previewItem instanceof LineItem) {
        // 丢弃当前未完成的预览
        try { manager.previewItem.remove(app?.scene); } catch {}
        manager.previewItem = null;
      }
      // 不切回 select，保持在 line 工具，便于下一次点击继续绘制
      // if (manager?.sketchSession?.setTool) manager.sketchSession.setTool('line');
      // try { manager.currentTool = 'line'; } catch {}
      // try { manager.isDrawing = true; } catch {}
      try { app?.renderOnce?.(); } catch {}
    } finally {
      // 解绑此次序列的完成/取消监听；下一次点击开始新序列时会重新绑定
      LineItem.disableFinishCancel(manager);
    }
  }

  // 取消绘制：同样清空当前预览，保持在“直线”工具，下一次点击可继续绘制
  static cancelLineTool(app: any, manager: any) {
    // 当前实现与 finish 类似：清空预览但不退出工具
    try {
      if (manager?.previewItem && manager.previewItem instanceof LineItem) {
        try { manager.previewItem.remove(app?.scene); } catch {}
        manager.previewItem = null;
      }
      // 保持在 line 工具，不切回 select
      // if (manager?.sketchSession?.setTool) manager.sketchSession.setTool('line');
      // try { manager.currentTool = 'line'; } catch {}
      // try { manager.isDrawing = true; } catch {}
      try { app?.renderOnce?.(); } catch {}
    } finally {
      LineItem.disableFinishCancel(manager);
    }
  }

  // 构造函数，接受两个THREE.Vector3类型的参数：start和end（end可以为null）
  constructor(public start: THREE.Vector3, public end: THREE.Vector3 | null = null) {
    super("line");
  }

  // 绘制线段的方法
  draw(scene: THREE.Scene) {
    // 如果end为空，则不绘制线段
    if (!this.end) return;

    // 创建BufferGeometry，并根据start和end设置线段的起点和终点
    const geom = new THREE.BufferGeometry().setFromPoints([this.start, this.end]);
    // 创建材质，颜色为青色（0x00ffff）
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffff });
    // 创建线段对象（Line），几何体和材质分别为上述创建的几何体和材质
    this.object3D = new THREE.Line(geom, mat);
    this.object3D.userData.isSketchItem = true; // 标记为草图对象
    // 将线段对象添加到场景中
    scene.add(this.object3D);
  }

  // 绘制线段预览的方法
  drawPreview(scene: THREE.Scene, cursorPos?: THREE.Vector3) {
    // 移除之前添加的线段对象
    this.remove(scene);

    // 如果没有传入鼠标位置，则不绘制预览
    if (!cursorPos) return;

    // 创建BufferGeometry，并根据start和cursorPos设置线段的起点和终点
    const geom = new THREE.BufferGeometry().setFromPoints([this.start, cursorPos]);
    // 创建材质，颜色为青色（0x00ffff），使用虚线样式
    const mat = new THREE.LineDashedMaterial({ color: 0x00ffff, dashSize: 1, gapSize: 0.5 });
    // 创建虚线对象（Line），几何体和材质分别为上述创建的几何体和材质
    const line = new THREE.Line(geom, mat);
    // 计算虚线的距离，以便正确显示虚线效果
    line.computeLineDistances();
    // 将线段对象设置为创建的虚线对象
    this.object3D = line;
    // 将线段对象添加到场景中
    scene.add(this.object3D);
  }

  toJSON() {
    return {
      type: 'line',
      start: this.start.toArray(),
      end: this.end?.toArray() ?? null,
    };
  }

  static fromJSON(data: any): LineItem {
    const start = new THREE.Vector3(...data.start);
    const end = data.end ? new THREE.Vector3(...data.end) : null;
    return new LineItem(start, end);
  }

  // 左键点击处理（保持原有逻辑）：
  // - 第一次点击：创建预览并开启“Enter/右键完成、Esc取消”的监听
  // - 第二次点击：落地一条线，并开始下一条（连续绘制）
  // - 若期间按下 Enter/右键/ESC，会结束当前序列；下一次点击再次开始新的序列
  static handleLineTool(app: any, manager: any, intersect: THREE.Vector3) {
    if (!manager.previewItem || !(manager.previewItem instanceof LineItem)) {
      manager.previewItem = new LineItem(intersect);
      // 首次进入连续绘制时启用完成/取消按键
      LineItem.enableFinishCancel(app, manager);
    } else {
      const l = manager.previewItem as LineItem;
      l.end = intersect.clone();
      l.remove(app.scene);
      l.draw(app.scene);
      manager.sketchItems.value.push(l);
      // 继续下一段预览（连续模式）
      manager.previewItem = new LineItem(intersect.clone());
    }
  }
}
