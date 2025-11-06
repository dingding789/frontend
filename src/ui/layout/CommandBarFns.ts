/**
 * CommandBarFns
 * 命令栏相关操作方法集合，集中管理 UI 交互逻辑
 * 包括草图工具切换、对话框显示、拉伸预览与确认等
 * 所有方法均为静态方法，便于在组件中直接调用
 */

import { RectExtrudeItem, CircleExtrudeItem, ExtrudeItem } from '../../core/geometry/features';
import type { SketchItem } from '../../core/geometry/sketchs';
import { ExtrudeEvents } from '../../core/managers/eventManager/featuresEvent/extrudeEvents';

export class CommandBarFns {
  static onRectClick(sketch, showRectDialog) {
    sketch.sketchSession.setTool('rect');
    if (showRectDialog && typeof showRectDialog === 'object' && 'value' in showRectDialog) {
      showRectDialog.value = true;
    }
  }

  static onRectModeSelect(sketch, showRectDialog, mode) {
    sketch.sketchSession.setRectMode(mode);
    showRectDialog.value = false;
  }

  static onCircleClick(sketch, showCircleDialog) {
    sketch.sketchSession.setTool('circle');
    if (showCircleDialog && typeof showCircleDialog === 'object' && 'value' in showCircleDialog) {
      showCircleDialog.value = true;
    }
  }

  static onCircleModeSelect(sketch, showCircleDialog, mode) {
    sketch.sketchSession.setCircleMode(mode);
    showCircleDialog.value = false;
  }

  static onArcClick(sketch, showArcDialog) {
    sketch.sketchSession.setTool('arc');
    if (showArcDialog && typeof showArcDialog === 'object' && 'value' in showArcDialog) {
      showArcDialog.value = true;
      }
    }

    static onArcModeSelect(sketch, showArcDialog, mode) {
      sketch.sketchSession.setArcMode(mode);
      showArcDialog.value = false;
    }

    static onSplineClick(sketch) {
      sketch.sketchSession.setTool('spline');
    }
    
    static onSplineModeSelect(sketch, showSplineCurveDialog, mode) {
      showSplineCurveDialog.value = false;
    }

  /**
   * 将草图项转换为拉伸特征项（ExtrudeItem）
   * 支持矩形和圆形草图项，其他类型返回null
   * @param sketch 草图项对象
   * @returns ExtrudeItem实例或null
   */
  static sketchItemToExtrudeItem(sketch: SketchItem): ExtrudeItem | null {
    if (sketch.type === 'rect') {
      // @ts-ignore
      return new RectExtrudeItem(sketch.p1, sketch.p2, sketch.plane || 'XY');
    }
    if (sketch.type === 'circle') {
      // @ts-ignore
      return new CircleExtrudeItem(sketch.center || sketch.p1, sketch.radius, sketch.plane || 'XY');
    }
    return null;
  }

  /**
   * 拉伸命令点击事件，弹出拉伸对话框并初始化选中项
   * 类型安全判断，避免showExtrudeDialog为布尔值时报错
   * @param extrude Extrude管理器
   * @param showExtrudeDialog 对话框显示ref（必须为对象且有value属性）
   * @param selectedSketch 选中的草图项ref
   * @param sketchItemToExtrudeItem 草图项转拉伸项方法
   */
  static onExtrudeClick(extrude, showExtrudeDialog, selectedSketch, sketchItemToExtrudeItem) {
    // 类型安全判断，避免showExtrudeDialog为布尔值时报错
    if (showExtrudeDialog && typeof showExtrudeDialog === 'object' && 'value' in showExtrudeDialog) {
      showExtrudeDialog.value = true;
    }
    if (selectedSketch && typeof selectedSketch === 'object' && 'value' in selectedSketch) {
      selectedSketch.value = null;
    }
    if (extrude.eventManager) {
      // 选中草图项后，转换为拉伸项并赋值
      extrude.eventManager.onSketchPicked = (sketch) => {
        if (selectedSketch && typeof selectedSketch === 'object' && 'value' in selectedSketch) {
          selectedSketch.value = sketchItemToExtrudeItem(sketch);
        }
      };
      extrude.eventManager.init();
    }
  }

  /**
   * 拉伸预览事件（UI入口，实际逻辑见ExtrudeEvents类）
   */
  static onExtrudePreview(app, extrude, selectedSketch, previewMesh, params) {
    ExtrudeEvents.onExtrudePreview(app, extrude, selectedSketch, previewMesh, params);
  }

  /**
   * 拉伸确认事件（UI入口，实际逻辑见ExtrudeEvents类）
   */
  static onExtrudeConfirm(app, extrude, selectedSketch, previewMesh, showExtrudeDialog, params) {
    ExtrudeEvents.onExtrudeConfirm(app, extrude, selectedSketch, previewMesh, showExtrudeDialog, params);
  }

  /**
   * 关闭拉伸预览和对话框事件（UI入口，实际逻辑见ExtrudeEvents类）
   */
  static onExtrudeClose(app, previewMesh, showExtrudeDialog) {
    ExtrudeEvents.onExtrudeClose(app, previewMesh, showExtrudeDialog);
  }
}
