import vtkAxesActor from '@kitware/vtk.js/Rendering/Core/AxesActor';
import vtkOrientationMarkerWidget from '@kitware/vtk.js/Interaction/Widgets/OrientationMarkerWidget';
import vtkTextActor from '@kitware/vtk.js/Rendering/Core/TextActor';
import vtkSphereSource from '@kitware/vtk.js/Filters/Sources/SphereSource';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';

export type AxisWidgetHandle = {
  widget: any;
  actor: any;
  originActor?: any;
  labels?: {
    x: any;
    y: any;
    z: any;
  };
  subs?: Array<{ unsubscribe?: () => void }>;
};

/**
 * 创建左下角坐标轴（较大尺寸、带X/Y/Z标签、自动跟随相机旋转）。
 * 这个实现使用 vtkOrientationMarkerWidget，不会干扰主渲染或模型导入。
 */
export function createAxisIndicator(interactor: any): AxisWidgetHandle | null {
  if (!interactor) return null;

  try {
    const actor = vtkAxesActor.newInstance();

    // 默认 recenter=true 会让箭头居中，导致出现负方向；这里关闭以从原点只指向正方向
    if (actor.setConfig && actor.getConfig) {
      actor.setConfig({
        ...actor.getConfig(),
        recenter: false,
      });
    }

    const widget = vtkOrientationMarkerWidget.newInstance({
      actor,
      interactor,
    });

    // 左下角 + 较大尺寸（参考用户图片）
    widget.setViewportCorner(vtkOrientationMarkerWidget.Corners.BOTTOM_LEFT);
    widget.setViewportSize(0.26); // 稍微放大
    widget.setMinPixelSize(140);
    widget.setMaxPixelSize(220);

    widget.setEnabled(true);

    const markerRenderer = widget.getRenderer?.();
    const view = interactor.getView?.();

    // 原点：在 marker renderer 里加一个小球（黑色点）
    let originActor: any = null;
    if (markerRenderer) {
      const sphere = vtkSphereSource.newInstance({
        radius: 0.06,
        thetaResolution: 24,
        phiResolution: 24,
        center: [0, 0, 0],
      });
      const sphereMapper = vtkMapper.newInstance();
      sphereMapper.setInputConnection(sphere.getOutputPort());
      originActor = vtkActor.newInstance();
      originActor.setMapper(sphereMapper);
      originActor.getProperty().setColor(0, 0, 0);
      originActor.getProperty().setAmbient(1.0);
      originActor.getProperty().setDiffuse(0.0);
      markerRenderer.addActor(originActor);
    }

    // 悬浮 X/Y/Z：用 TextActor(2D) + 投影定位到箭头端点附近
    const labels = createAxisLabels(markerRenderer);
    const subs: Array<{ unsubscribe?: () => void }> = [];

    const update = () => {
      try {
        updateAxisLabelsPosition({ actor, markerRenderer, view, labels });
        interactor.render?.();
      } catch (e) {
        // 标签更新失败不应影响主流程
      }
    };

    // 初始定位
    update();

    // 再推迟一帧/两帧强制更新，避免初始渲染前尺寸未就绪导致姿态异常
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        update();
        requestAnimationFrame(update);
      });
    }

    // 交互时持续更新（拖拽旋转/缩放时）
    const onAnim = interactor.onAnimation?.(update);
    const onEndAnim = interactor.onEndAnimation?.(update);
    if (onAnim) subs.push(onAnim);
    if (onEndAnim) subs.push(onEndAnim);

    // 相机非动画修改时也更新一次
    const parentRen = widget.getParentRenderer?.() || interactor.getCurrentRenderer?.();
    const cam = parentRen?.getActiveCamera?.();
    const onCam = cam?.onModified?.(update);
    if (onCam) subs.push(onCam);

    return { widget, actor, originActor, labels, subs };
  } catch (e) {
    // 坐标轴是辅助功能：失败时不应阻断主渲染/模型导入
    console.warn('[Axis] createAxisIndicator failed:', e);
    return null;
  }
}

function createStyledTextActor(text: string, rgb: [number, number, number]) {
  const textActor = vtkTextActor.newInstance();
  const prop = textActor.getProperty?.();
  // 先设置 TextProperty，再设置 input 触发纹理重建（TextActor 只在 input 变化时生成贴图）
  // vtkTextProperty 的颜色是 0..1（float）
  (prop as any)?.setFontColor?.(rgb[0], rgb[1], rgb[2]);
  prop?.setFontFamily?.('Arial');
  prop?.setFontStyle?.('bold');

  // 适当放大字体
  prop?.setResolution?.(32);
  (prop as any)?.setFontSizeScale?.(() => 10);

  // 触发贴图创建（使用上面设置的颜色/字号）
  textActor.setInput(text);
  return textActor;
}

function createAxisLabels(markerRenderer: any) {
  const labels = {
    x: createStyledTextActor('X', [1, 1, 1]),
    y: createStyledTextActor('Y', [1, 1, 1]),
    z: createStyledTextActor('Z', [1, 1, 1]),
  };

  try {
    markerRenderer?.addActor2D?.(labels.x);
    markerRenderer?.addActor2D?.(labels.y);
    markerRenderer?.addActor2D?.(labels.z);
  } catch (e) {
    // ignore
  }

  return labels;
}

function updateAxisLabelsPosition(opts: {
  actor: any;
  markerRenderer: any;
  view: any;
  labels: { x: any; y: any; z: any };
}) {
  const { actor, markerRenderer, view, labels } = opts;
  if (!actor || !markerRenderer || !view || !labels) return;

  const canvasSize = view.getSize?.();
  if (!canvasSize || canvasSize.length < 2) return;

  const viewportPx = view.getViewportSize?.(markerRenderer);
  const aspect = viewportPx && viewportPx[1] ? viewportPx[0] / viewportPx[1] : canvasSize[0] / Math.max(canvasSize[1], 1);

  const bounds = actor.getBounds?.();
  if (!bounds || bounds.length < 6) return;

  // 箭头端点：取各轴正向最大值，并稍微外扩一点点
  const scale = 1.03;
  const xTip = bounds[1] * scale;
  const yTip = bounds[3] * scale;
  const zTip = bounds[5] * scale;

  const xPos = worldToDisplay(markerRenderer, view, canvasSize, aspect, [xTip, 0, 0]);
  const yPos = worldToDisplay(markerRenderer, view, canvasSize, aspect, [0, yTip, 0]);
  const zPos = worldToDisplay(markerRenderer, view, canvasSize, aspect, [0, 0, zTip]);

  // 轻微像素偏移，避免盖住箭头尖
  const pad = 2;
  if (xPos) labels.x.setDisplayPosition(xPos[0] + pad, xPos[1] + pad);
  if (yPos) labels.y.setDisplayPosition(yPos[0] + pad, yPos[1] + pad);
  if (zPos) labels.z.setDisplayPosition(zPos[0] + pad, zPos[1] + pad);
}

function worldToDisplay(
  renderer: any,
  view: any,
  canvasSize: [number, number],
  aspect: number,
  world: [number, number, number]
): [number, number] | null {
  const nd = renderer.worldToNormalizedDisplay?.(world[0], world[1], world[2], aspect);
  if (!nd || nd.length < 2) return null;
  const x = Math.round(nd[0] * canvasSize[0]);
  const y = Math.round(nd[1] * canvasSize[1]);
  return [x, y];
}

export function removeAxisIndicator(handle: AxisWidgetHandle | null) {
  if (!handle) return;
  try {
    if (handle.subs) {
      handle.subs.forEach(s => {
        try {
          s?.unsubscribe?.();
        } catch (e) {
          // ignore
        }
      });
      handle.subs = [];
    }

    const markerRenderer = handle.widget?.getRenderer?.();
    if (markerRenderer && handle.labels) {
      markerRenderer.removeActor2D?.(handle.labels.x);
      markerRenderer.removeActor2D?.(handle.labels.y);
      markerRenderer.removeActor2D?.(handle.labels.z);
    }

    if (markerRenderer && handle.originActor) {
      markerRenderer.removeActor?.(handle.originActor);
    }

    handle.widget?.setEnabled?.(false);
  } finally {
    handle.labels?.x?.delete?.();
    handle.labels?.y?.delete?.();
    handle.labels?.z?.delete?.();
    handle.widget?.delete?.();
    handle.actor?.delete?.();
    handle.originActor?.delete?.();
  }
}
