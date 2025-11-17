// extrudeEvents.ts
// 拉伸相关事件处理类，负责拉伸预览、确认、关闭等逻辑
// 仅处理 Extrude 相关的事件，不涉及 UI 组件

import * as THREE from 'three';
import { MouseEventBase } from '../MouseEventBase';

export class ExtrudeEvents {
  /**
   * 拉伸预览事件
   * @param app THREE应用管理器
   * @param extrude Extrude管理器
   * @param selectedSketch 选中的草图项ref
   * @param previewMesh 预览Mesh的ref对象
   * @param params 拉伸参数
   */
  static onExtrudePreview(app, extrude, selectedSketch, previewMesh, params) {
    if (!selectedSketch || typeof selectedSketch !== 'object' || !('value' in selectedSketch) || !selectedSketch.value) return;
    if (previewMesh && typeof previewMesh === 'object' && 'value' in previewMesh && previewMesh.value) {
      app.scene.remove(previewMesh.value);
      previewMesh.value = null;
    }
    const mesh = extrude.createPreviewExtrudeFromItem(selectedSketch.value, params);
    if (mesh && previewMesh && typeof previewMesh === 'object' && 'value' in previewMesh) {
      previewMesh.value = mesh;
      app.scene.add(mesh);
    }
  }

  /**
   * 拉伸确认事件
   * @param app THREE应用管理器
   * @param extrude Extrude管理器
   * @param selectedSketch 选中的草图项ref
   * @param previewMesh 预览Mesh的ref对象
   * @param showExtrudeDialog 拉伸对话框显示ref对象
   * @param params 拉伸参数
   */
  static onExtrudeConfirm(app, extrude, selectedSketch, previewMesh, showExtrudeDialog, params) {
    if (previewMesh && typeof previewMesh === 'object' && 'value' in previewMesh && previewMesh.value) {
      app.scene.remove(previewMesh.value);
      previewMesh.value = null;
    }
    if (selectedSketch && typeof selectedSketch === 'object' && 'value' in selectedSketch && selectedSketch.value) {
      extrude.createExtrudeFromItem(selectedSketch.value, params);
      if (showExtrudeDialog && typeof showExtrudeDialog === 'object' && 'value' in showExtrudeDialog) {
        showExtrudeDialog.value = false;
      }
    }
  }

  /**
   * 关闭拉伸预览和对话框事件
   * @param app THREE应用管理器
   * @param previewMesh 预览Mesh的ref对象
   * @param showExtrudeDialog 拉伸对话框显示ref对象
   */
  static onExtrudeClose(app, previewMesh, showExtrudeDialog) {
    if (previewMesh && typeof previewMesh === 'object' && 'value' in previewMesh && previewMesh.value) {
      app.scene.remove(previewMesh.value);
      previewMesh.value = null;
    }
    if (showExtrudeDialog && typeof showExtrudeDialog === 'object' && 'value' in showExtrudeDialog) {
      showExtrudeDialog.value = false;
    }
  }
}

/**
 * 小型工具类：继承 MouseEventBase 使用其 raycast / getNDCFromEvent 实用方法
 * 提供一次性拾取（不绑定事件），用于替换原有的基于手动 Raycaster 的实现
 */
 export class ExtrudePicker extends MouseEventBase {
  public raycast(event: PointerEvent): any {
    // Call the base class raycast if it exists
    return super['raycast'] ? super['raycast'](event) : null;
  }

  // 改为 pointerdown
  protected eventType(): string {
    return 'pointerdown';
  }

  // 使用 PointerEvent 签名
  protected handleEvent(e: PointerEvent): void {
    console.log('ExtrudePicker.handleEvent', e);
    this.pickOnce(e);
  }

  /**
   * 执行一次拾取并返回对应的草图项或 null
   * 兼容原来 onExtrudeMouseClick 的行为（使用 manager.allSketchItems）
   */
  pickOnce(event: MouseEvent | PointerEvent, onSketchPicked?: (sketch: any) => void) {
    // 使用基类的 raycast 方法进行拾取
    const ndEvent = event as PointerEvent;
    const intersect = this.raycast(ndEvent);
    if (!intersect) return null;

    const obj = intersect.object;
    // manager 预计含有 allSketchItems（二维数组）
    const allItems = (this.manager?.allSketchItems) ? this.manager.allSketchItems : [];
    // 扁平查找与原实现一致
    const hit = allItems.flat().find(j => j.object3D === obj) ?? null;
    if (hit && typeof onSketchPicked === 'function') onSketchPicked(hit);
    return hit;
  }
}

/**
 * 兼容函数：保持原 onExtrudeMouseClick API，但内部使用 ExtrudePicker（继承 MouseEventBase）
 * @param app 应用管理器
 * @param manager 草图管理器（期望包含 allSketchItems）
 * @param event 鼠标/指针事件
 * @param onSketchPicked 选中回调
 */
export function onExtrudeMouseClick(app, manager, event, onSketchPicked?: (sketch: any) => void) {
  const picker = new ExtrudePicker(app, manager, null);
  return picker.pickOnce(event, onSketchPicked);
}
