import * as THREE from 'three';
import { SketchItem } from './SketchItem';

// 支持两点圆和三点圆
export type CircleMode = 'two-point' | 'three-point';

// 计算与给定法向正交的局部坐标系 (axisU, axisV)
function makePlaneLocalBasis(normal: THREE.Vector3): { axisU: THREE.Vector3; axisV: THREE.Vector3 } {
  const normalizedNormal = normal.clone().normalize();
  const referenceAxis = Math.abs(normalizedNormal.z) < 0.99 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const axisU = new THREE.Vector3().crossVectors(normalizedNormal, referenceAxis).normalize();
  const axisV = new THREE.Vector3().crossVectors(normalizedNormal, axisU).normalize();
  return { axisU, axisV };
}

export class CircleItem extends SketchItem {
  public center: THREE.Vector3;
  public radius: number;
  public mode: CircleMode;
  public point1: THREE.Vector3;
  public point2?: THREE.Vector3;
  public point3?: THREE.Vector3;
  public planeNormal: THREE.Vector3;
  private axisU: THREE.Vector3;
  private axisV: THREE.Vector3;

  constructor(
    mode: CircleMode,
    point1: THREE.Vector3,
    point2: THREE.Vector3,
    point3?: THREE.Vector3,
    planeNormal: THREE.Vector3 = new THREE.Vector3(0, 0, 1)
  ) {
    super("circle");
    this.mode = mode;
    this.point1 = point1;
    this.point2 = point2;
    this.point3 = point3;
    this.planeNormal = planeNormal.clone().normalize();

    const planeBasis = makePlaneLocalBasis(this.planeNormal);
    this.axisU = planeBasis.axisU;
    this.axisV = planeBasis.axisV;

    if (mode === 'two-point') {
      this.center = point1.clone();
      this.radius = point1.distanceTo(point2);
    } else {
      if (point3) {
        const circleBy3 = calcCircleBy3PointsOnPlane(point1, point2, point3, this.planeNormal);
        this.center = circleBy3.center;
        this.radius = circleBy3.radius;
      } else {
        this.center = point1.clone();
        this.radius = 0;
      }
    }
  }

  /** 从后端 JSON 还原（供 SketchFactory 调用） */
  static fromJSON(data: any): CircleItem {
    const mode: CircleMode = (data.mode as CircleMode) ?? 'two-point';
    const planeNormalFromJson = Array.isArray(data.planeNormal) ? new THREE.Vector3(...data.planeNormal) : new THREE.Vector3(0, 0, 1);

    const hasPoint1 = Array.isArray(data.point1) && data.point1.length === 3;
    const hasPoint2 = Array.isArray(data.point2) && data.point2.length === 3;
    const hasPoint3 = Array.isArray(data.point3) && data.point3.length === 3;
    const hasCenter = Array.isArray(data.center) && data.center.length === 3; // 兼容 center+radius 结构
    const radiusFromJson = typeof data.radius === 'number' ? data.radius : 0;

    const point1 = hasPoint1
      ? new THREE.Vector3(...data.point1)
      : hasCenter
      ? new THREE.Vector3(...data.center)
      : new THREE.Vector3(0, 0, 0);

    const planeBasis = makePlaneLocalBasis(planeNormalFromJson);

    let point2: THREE.Vector3 | undefined = hasPoint2 ? new THREE.Vector3(...data.point2) : undefined;
    let point3: THREE.Vector3 | undefined = hasPoint3 ? new THREE.Vector3(...data.point3) : undefined;

    if (!point2) {
      if (radiusFromJson > 0) {
        point2 = point1.clone().add(planeBasis.axisU.clone().multiplyScalar(radiusFromJson));
      } else {
        point2 = point1.clone();
      }
    }

    const circleItem = new CircleItem(mode, point1, point2, point3, planeNormalFromJson);

    if (radiusFromJson > 0) {
      circleItem.center = point1.clone();
      circleItem.radius = radiusFromJson;
    } else if (mode === 'three-point' && point2 && point3) {
      const circleBy3 = calcCircleBy3PointsOnPlane(point1, point2, point3, planeNormalFromJson);
      circleItem.center = circleBy3.center;
      circleItem.radius = circleBy3.radius;
    } else if (point1 && point2) {
      circleItem.center = point1.clone();
      circleItem.radius = point1.distanceTo(point2);
    } else {
      circleItem.center = point1.clone();
      circleItem.radius = 0;
    }

    return circleItem;
  }

  draw(scene: THREE.Scene) {
    if (!this.center || this.radius <= 0) return;
    const circlePoints: THREE.Vector3[] = [];
    const segmentCount = 64;
    for (let i = 0; i <= segmentCount; i++) {
      const theta = (i / segmentCount) * 2 * Math.PI;
      const offsetOnPlane = this.axisU.clone().multiplyScalar(this.radius * Math.cos(theta))
        .add(this.axisV.clone().multiplyScalar(this.radius * Math.sin(theta)));
      circlePoints.push(this.center.clone().add(offsetOnPlane));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(circlePoints);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff });
    this.object3D = new THREE.LineLoop(geometry, lineMaterial);
    this.object3D.userData.isSketchItem = true;
    scene.add(this.object3D);
  }

  drawPreview(scene: THREE.Scene, cursorWorldPosition?: THREE.Vector3) {
    this.remove(scene);
    if (!cursorWorldPosition) return;

    let previewCenter: THREE.Vector3, previewRadius: number;
    if (this.mode === 'two-point') {
      previewCenter = this.point1;
      previewRadius = this.point1.distanceTo(cursorWorldPosition);
    } else if (this.mode === 'three-point') {
      if (!this.point2) return;
      const circleBy3 = calcCircleBy3PointsOnPlane(this.point1, this.point2, cursorWorldPosition, this.planeNormal);
      previewCenter = circleBy3.center;
      previewRadius = circleBy3.radius;
      if (previewRadius === 0) return;
    } else return;

    const previewPoints: THREE.Vector3[] = [];
    const segmentCount = 64;
    for (let i = 0; i <= segmentCount; i++) {
      const theta = (i / segmentCount) * 2 * Math.PI;
      const offsetOnPlane = this.axisU.clone().multiplyScalar(previewRadius * Math.cos(theta))
        .add(this.axisV.clone().multiplyScalar(previewRadius * Math.sin(theta)));
      previewPoints.push(previewCenter.clone().add(offsetOnPlane));
    }
    // 预览使用 Line + Dashed，手动闭合（首尾重复一点），避免 LineLoop + Dashed 渲染异常
    previewPoints.push(previewPoints[0].clone());

    const geometry = new THREE.BufferGeometry().setFromPoints(previewPoints);
    const dashedMaterial = new THREE.LineDashedMaterial({ color: 0x00ffff, dashSize: 1, gapSize: 0.5 });
    const dashedLine = new THREE.Line(geometry, dashedMaterial);
    dashedLine.computeLineDistances();
    dashedLine.userData.isSketchItem = true;
    this.object3D = dashedLine;
    scene.add(this.object3D);
  }

  /** 保存到后端 JSON */
  toJSON() {
    return {
      type: 'circle',
      mode: this.mode,
      point1: this.point1.toArray(),
      point2: this.point2?.toArray(),
      point3: this.point3?.toArray(),
      planeNormal: this.planeNormal.toArray(),
      radius: this.radius ?? 0
    };
  }

  static handleCircleTool(app: any, manager: any, intersectionPoint: THREE.Vector3, mode: 'two-point' | 'three-point', plane: THREE.Plane) {
    const selectedPlaneNormal = plane?.normal.clone() ?? new THREE.Vector3(0, 0, 1);
    const { previewItem } = manager;

    if (mode === 'two-point') {
      if (!previewItem || !(previewItem instanceof CircleItem) || previewItem.mode !== 'two-point') {
        manager.previewItem = new CircleItem('two-point', intersectionPoint.clone(), intersectionPoint.clone(), undefined, selectedPlaneNormal);
      } else {
        const circleItem = manager.previewItem as CircleItem;
        circleItem.point2 = intersectionPoint.clone();
        circleItem.center = circleItem.point1.clone();
        circleItem.radius = circleItem.point1.distanceTo(circleItem.point2);
        circleItem.remove(app.scene);
        circleItem.draw(app.scene);
        manager.sketchItems.value.push(circleItem);
        manager.previewItem = null;
        app.renderOnce();
      }
    } else {
      // three-point
      if (!previewItem || !(previewItem instanceof CircleItem) || previewItem.mode !== 'three-point') {
        // 首次点击：仅确定第一个点；不要让 point2=point1，避免退化
        const circleItem = new CircleItem('three-point', intersectionPoint.clone(), intersectionPoint.clone(), undefined, selectedPlaneNormal);
        circleItem.point2 = undefined;
        circleItem.point3 = undefined;
        circleItem.center = circleItem.point1.clone();
        circleItem.radius = 0;
        manager.previewItem = circleItem;
      } else {
        const circleItem = manager.previewItem as CircleItem;
        if (!circleItem.point2) {
          // 第二次点击：确定第二点；之后鼠标移动预览第三点
          circleItem.point2 = intersectionPoint.clone();
          circleItem.center = circleItem.point1.clone();
          circleItem.radius = circleItem.point1.distanceTo(circleItem.point2);
          app.renderOnce();
        } else if (!circleItem.point3) {
          // 第三次点击：确定第三点并落地
          circleItem.point3 = intersectionPoint.clone();
          const circleBy3 = calcCircleBy3PointsOnPlane(circleItem.point1, circleItem.point2, circleItem.point3, selectedPlaneNormal);
          circleItem.center = circleBy3.center;
          circleItem.radius = circleBy3.radius;
          circleItem.remove(app.scene);
          circleItem.draw(app.scene);
          manager.sketchItems.value.push(circleItem);
          manager.previewItem = null;
          app.renderOnce();
        }
      }
    }
  }
}

// 通过三点计算圆心和半径（带平面法向）
export function calcCircleBy3PointsOnPlane(
  point1: THREE.Vector3,
  point2: THREE.Vector3,
  point3: THREE.Vector3,
  planeNormal: THREE.Vector3
): { center: THREE.Vector3; radius: number } {
  const planeNormalNormalized = planeNormal.clone().normalize();
  const planeBasis = makePlaneLocalBasis(planeNormalNormalized);

  const projectToPlane2D = (point: THREE.Vector3) => {
    const delta = point.clone().sub(point1);
    return { x: delta.dot(planeBasis.axisU), y: delta.dot(planeBasis.axisV) };
    // 以 point1 为原点，在 (axisU, axisV) 平面坐标系下的 2D 坐标
  };

  const pointA2D = { x: 0, y: 0 };
  const pointB2D = projectToPlane2D(point2);
  const pointC2D = projectToPlane2D(point3);

  const coefA = 2 * (pointB2D.x - pointA2D.x);
  const coefB = 2 * (pointB2D.y - pointA2D.y);
  const coefC = 2 * (pointC2D.x - pointA2D.x);
  const coefD = 2 * (pointC2D.y - pointA2D.y);
  const rhsE = pointB2D.x * pointB2D.x + pointB2D.y * pointB2D.y - pointA2D.x * pointA2D.x - pointA2D.y * pointA2D.y;
  const rhsF = pointC2D.x * pointC2D.x + pointC2D.y * pointC2D.y - pointA2D.x * pointA2D.x - pointA2D.y * pointA2D.y;

  const denominator = coefA * coefD - coefB * coefC;
  if (Math.abs(denominator) < 1e-6) return { center: point1.clone(), radius: 0 };

  const centerX2D = (coefD * rhsE - coefB * rhsF) / denominator;
  const centerY2D = (coefA * rhsF - coefC * rhsE) / denominator;

  const center = point1.clone()
    .add(planeBasis.axisU.clone().multiplyScalar(centerX2D))
    .add(planeBasis.axisV.clone().multiplyScalar(centerY2D));

  const radius = Math.sqrt(centerX2D * centerX2D + centerY2D * centerY2D);
  return { center, radius };
}

// 将从后端还原的草图项（尚未 draw 的）统一绘制出来
export function rehydrateSketches(app: any, manager: any) {
  const sketchItems = (manager.sketchItems?.value ?? []) as any[];
  for (const sketchItem of sketchItems) {
    if (!sketchItem) continue;
    if (!sketchItem.object3D && typeof sketchItem.draw === 'function') {
      try { sketchItem.draw(app.scene); } catch {}
    }
  }
  app?.renderOnce?.();
}


