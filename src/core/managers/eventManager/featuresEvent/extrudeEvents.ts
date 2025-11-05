// extrudeEvents.ts
// 拉伸相关事件处理类，负责拉伸预览、确认、关闭等逻辑
// 仅处理 Extrude 相关的事件，不涉及 UI 组件

import * as THREE from 'three';

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
 * 拉伸体鼠标点击事件处理
 * @param app THREE应用管理器
 * @param manager 草图管理器
 * @param event 鼠标点击事件
 * @param onSketchPicked 选中回调
 */
export function onExtrudeMouseClick(app, manager, event, onSketchPicked?: (sketch: any) => void) {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const rect = app.renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, app.camera);
  const allItems = manager.allSketchItems;
  const objects = allItems.flat().map(i => i.object3D).filter(Boolean) as THREE.Object3D[];
  const intersects = raycaster.intersectObjects(objects);
  if (intersects.length > 0) {
    const obj = intersects[0].object;
    const hit = allItems.flat().find(j => j.object3D === obj) ?? null;
    if (hit && onSketchPicked) {
      onSketchPicked(hit);
    }
    return hit;
  }
  return null;
}
