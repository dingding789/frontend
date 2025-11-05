/**
 * ArcItem
 * 表示草图中的圆弧元素，支持三点绘制、预览、序列化等
 * 静态方法 handleArcTool 用于草图交互逻辑
 */
import * as THREE from 'three';
import { SketchItem } from './SketchItem';

export class ArcItem extends SketchItem {
  private center?: THREE.Vector3;
  private radius?: number;
  private startAngle?: number;
  private endAngle?: number;

  constructor(public points: THREE.Vector3[] = []) {
    super("arc");
  }

  // 约定：this.points[0]=P1，this.points[1]=P2，this.points[2]=P3(可选，预览时用光标)

  /**
   * 根据三个点计算所在平面的正交基向量
   * @param point1 第一个点
   * @param point2 第二个点  
   * @param point3 第三个点
   * @returns 包含平面法向量和两个正交基向量的对象
   */


  // === 工具函数：由三点确定平面正交基 ===
  private static makePlaneBasisFromPoints(point1: THREE.Vector3, point2: THREE.Vector3, point3: THREE.Vector3) {
    //计算从point1到point2和point1到point3的向量
    const vector12 = new THREE.Vector3().subVectors(point2, point1);
    const vector13 = new THREE.Vector3().subVectors(point3, point1);

    //通过叉积计算平面法向量（垂直于平面）
    let planeNormal = new THREE.Vector3().crossVectors(vector12, vector13);
    const normalLength = planeNormal.length();
    if (normalLength < 1e-12) {
      // 三点近共线：兜底法向
      planeNormal.set(0, 0, 1);
    } else {
      //归一化法向量
      planeNormal.divideScalar(normalLength);
    }

    // basisU 取 P1->P2 在平面上的方向
    const basisU = vector12.clone().sub(planeNormal.clone().multiplyScalar(vector12.dot(planeNormal)));
    //如果投影长度接近0，使用默认x轴方向
    if (basisU.lengthSq() < 1e-12) basisU.set(1, 0, 0); else basisU.normalize();
    //basis V：通过法向量和u轴叉积得到v轴基向量
    const basisV = new THREE.Vector3().crossVectors(planeNormal, basisU).normalize();
    return { planeNormal, basisU, basisV };
  }

  /**
   * 将3D点转换为2D平面坐标
   * @param point 要转换的3D点
   * @param origin 平面原点
   * @param basisU U轴基向量
   * @param basisV V轴基向量
   * @returns 在平面坐标系中的2D坐标
   */

  private static to2D(point: THREE.Vector3, origin: THREE.Vector3, basisU: THREE.Vector3, basisV: THREE.Vector3) {
    const offset = point.clone().sub(origin);
    return { x: offset.dot(basisU), y: offset.dot(basisV) };
  }

  // 三点定圆（使用三点决定的平面）
  private static circleFromThreePointsOnPlane(point1: THREE.Vector3, point2: THREE.Vector3, point3: THREE.Vector3) {
    //获取三点所在平面的正交基
    const { planeNormal, basisU, basisV } = ArcItem.makePlaneBasisFromPoints(point1, point2, point3);

    // 将 point1 作为 2D 原点
    const origin2D = { x: 0, y: 0 };
    //将point2和point3转换为2D平面坐标
    const point2OnUV = ArcItem.to2D(point2, point1, basisU, basisV);
    const point3OnUV = ArcItem.to2D(point3, point1, basisU, basisV);

    //计算两条弦的中垂线交点（即圆心）
    // 方程系数（来源：两条弦的中垂线联立）
    const coeffX1 = 2 * (point2OnUV.x - origin2D.x);
    const coeffY1 = 2 * (point2OnUV.y - origin2D.y);
    const coeffX2 = 2 * (point3OnUV.x - origin2D.x);
    const coeffY2 = 2 * (point3OnUV.y - origin2D.y);
    //中垂线方程的右侧常数项
    const rhs1 = point2OnUV.x * point2OnUV.x + point2OnUV.y * point2OnUV.y - origin2D.x * origin2D.x - origin2D.y * origin2D.y;
    const rhs2 = point3OnUV.x * point3OnUV.x + point3OnUV.y * point3OnUV.y - origin2D.x * origin2D.x - origin2D.y * origin2D.y;

    //计算行里是，如果接近0则说明两条中垂线平行（三点共线）
    const determinant = coeffX1 * coeffY2 - coeffY1 * coeffX2;
    if (Math.abs(determinant) < 1e-12) return null;

    //解线性方程组得到圆心在2D平面坐标系的坐标
    const centerX2D = (coeffY2 * rhs1 - coeffY1 * rhs2) / determinant;
    const centerY2D = (coeffX1 * rhs2 - coeffX2 * rhs1) / determinant;

    //将2D圆心坐标转换回3D空间坐标
    const circleCenter = point1.clone()
      .add(basisU.clone().multiplyScalar(centerX2D))
      .add(basisV.clone().multiplyScalar(centerY2D));

      //计算圆的半径
    const circleRadius = Math.sqrt(centerX2D * centerX2D + centerY2D * centerY2D);

    return { center: circleCenter, radius: circleRadius, planeNormal, basisU, basisV };
  }

  /**
   * 计算点在平面坐标系中相对于圆心的角度
   * @param center 圆心坐标
   * @param point 要计算角度的点
   * @param basisU U轴基向量
   * @param basisV V轴基向量
   * @returns 点的角度（弧度）
   */

  private static angleOnUV(center: THREE.Vector3, point: THREE.Vector3, basisU: THREE.Vector3, basisV: THREE.Vector3) {
    //计算点到圆心的偏移向量
    const offset = point.clone().sub(center);
    //使用atan2计算角度，考虑四个象限
    return Math.atan2(offset.dot(basisV), offset.dot(basisU));
  }

  /**
   * 判断测试角度是否在起始角度到结束角度的逆时针区间内
   * @param angleStart 起始角度
   * @param angleEnd 结束角度
   * @param angleTest 要测试的角度
   * @returns 如果测试角度在区间内返回true，否则返回false
   */

  // 判断 angleTest 是否在从 angleStart 逆时针到 angleEnd 的区间内
  private static isAngleBetweenCounterClockwise(angleStart: number, angleEnd: number, angleTest: number) {
    //角度归一化函数：将角度范围规定到 [0, 2π)范围内
    const normalizeAngle = (ang: number) => {
      let t = ang % (Math.PI * 2);//取模
      if (t < 0) t += Math.PI * 2;//处理负角度
      return t;
    };

    //归一化所有角度
    let startNorm = normalizeAngle(angleStart);
    let endNorm = normalizeAngle(angleEnd);
    let testNorm = normalizeAngle(angleTest);
    //如果结果角度小于起始角度，说明跨越了2π边界，调整结束角度
    if (endNorm < startNorm) endNorm += Math.PI * 2;
    // 如果测试角度小于起始角度，同样调整
    if (testNorm < startNorm) testNorm += Math.PI * 2;
    // 检查测试角度是否在调整后的区间内
    return testNorm <= endNorm;
  }
 /**
   * 构建端点P1、P2之间且经过P3的弧线点集
   * @param point1 起点P1
   * @param point2 终点P2  
   * @param point3 中间点P3（确定弧线弯曲方向）
   * @param steps 弧线采样点数
   * @returns 弧线上的点数组，如果三点共线返回null
   */
  // 只取“端点为 point1、point2，且经过 point3”的那一段弧
  private buildArcPointsBetween(point1: THREE.Vector3, point2: THREE.Vector3, point3: THREE.Vector3, steps = 64): THREE.Vector3[] | null {
    //计算三点确定的圆
    const circle = ArcItem.circleFromThreePointsOnPlane(point1, point2, point3);
    if (!circle) return null;
    const { center: circleCenter, radius: circleRadius, basisU, basisV } = circle;

    // 记录圆参
    this.center = circleCenter;
    this.radius = circleRadius;

    // 三点相对角
    const angleAtPoint1 = ArcItem.angleOnUV(circleCenter, point1, basisU, basisV);
    const angleAtPoint2 = ArcItem.angleOnUV(circleCenter, point2, basisU, basisV);
    const angleAtPoint3 = ArcItem.angleOnUV(circleCenter, point3, basisU, basisV);

    // 确定方向：如果 第三点角 在 point1->point2 的 CCW 区间内，则走 CCW，否则走 CW
    let startAngleLocal = angleAtPoint1;
    let endAngleLocal = angleAtPoint2;
    const isThirdInCCWSector = ArcItem.isAngleBetweenCounterClockwise(angleAtPoint1, angleAtPoint2, angleAtPoint3);
    if (isThirdInCCWSector) {
      if (endAngleLocal < startAngleLocal) endAngleLocal += Math.PI * 2;
    } else {
      if (endAngleLocal > startAngleLocal) startAngleLocal += Math.PI * 2; // CW
    }

    // 采样生成弧线上的点
    const pointsOnArc: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      //计算当前点的角度
      const angle = startAngleLocal + (endAngleLocal - startAngleLocal) * t;
      //计算当前点在2D平面上的坐标
      const x = Math.cos(angle) * circleRadius;
      const y = Math.sin(angle) * circleRadius;
      //将2D坐标转换回3D空间坐标并添加到点数组中
      pointsOnArc.push(circleCenter.clone().add(basisU.clone().multiplyScalar(x)).add(basisV.clone().multiplyScalar(y)));
    }
    //存储起始和结束角度
    this.startAngle = startAngleLocal;
    this.endAngle = endAngleLocal;

    return pointsOnArc;
  }
   /**
   * 最终绘制方法：生成固定弧线并添加到场景
   * @param scene 要添加到的Three.js场景
   */

  // 最终绘制（固定端点 P1/P2，P3 决定弧）
  draw(scene: THREE.Scene) {
    this.remove(scene);
    if (!this.points || this.points.length < 3) return;
    const [p1, p2, p3] = this.points;
    const pts = this.buildArcPointsBetween(p1, p2, p3);
    if (!pts || !this.radius || this.radius <= 0) return;

    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffff });
    this.object3D = new THREE.Line(geom, mat);
    this.object3D.userData.isSketchItem = true;
    scene.add(this.object3D);
  }

  // 预览：锁定第二点后，鼠标作为第三点仅影响弧内形状；端点不动
  drawPreview(scene: THREE.Scene, cursorPos?: THREE.Vector3) {
    this.remove(scene);
    if (!cursorPos || !this.points || this.points.length < 2) return;

    const p1 = this.points[0];
    const p2 = this.points[1];
    const pts = this.buildArcPointsBetween(p1, p2, cursorPos);
    if (!pts) return;

    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({ color: 0x00ccff, dashSize: 1, gapSize: 0.5 });
    const line = new THREE.Line(geom, mat);
    line.computeLineDistances();
    this.object3D = line;
    this.object3D.userData.isSketchItem = true;
    scene.add(this.object3D);
  }

  toJSON() {
    return {
      type: 'arc',
      // 改为显式三点坐标，便于直观看到端点与第三点
      point1: this.points[0] ? this.points[0].toArray() : null,
      point2: this.points[1] ? this.points[1].toArray() : null,
      point3: this.points[2] ? this.points[2].toArray() : null,
      center: this.center ? this.center.toArray() : null,
      radius: this.radius ?? 0,
      startAngle: this.startAngle ?? null,
      endAngle: this.endAngle ?? null,
      // 弧长：半径×角度差的绝对值
      arcLength://弧度值
        this.radius && this.startAngle !== undefined && this.endAngle !== undefined
          ? Math.abs(this.endAngle - this.startAngle) * this.radius
          : 0
    };
  }

  static fromJSON(data: any): ArcItem {
    const arr3 = (v: any) => Array.isArray(v) && v.length === 3;
    // 兼容：优先 point1/point2/point3；回退到旧的 points[0..2]
    const p1Arr = arr3(data.point1) ? data.point1 : (Array.isArray(data.points) && arr3(data.points[0]) ? data.points[0] : null);
    const p2Arr = arr3(data.point2) ? data.point2 : (Array.isArray(data.points) && arr3(data.points[1]) ? data.points[1] : null);
    const p3Arr = arr3(data.point3) ? data.point3 : (Array.isArray(data.points) && arr3(data.points[2]) ? data.points[2] : null);

    const pts: THREE.Vector3[] = [];
    if (p1Arr) pts.push(new THREE.Vector3(...p1Arr));
    if (p2Arr) pts.push(new THREE.Vector3(...p2Arr));
    if (p3Arr) pts.push(new THREE.Vector3(...p3Arr));

    const arcItem = new ArcItem(pts);

    if (arr3(data.center)) arcItem.center = new THREE.Vector3(...data.center);
    if (typeof data.radius === 'number') arcItem.radius = data.radius;
    if (typeof data.startAngle === 'number') arcItem.startAngle = data.startAngle;
    if (typeof data.endAngle === 'number') arcItem.endAngle = data.endAngle;

    // 若三点齐全但缺圆参，则根据三点计算一次，以填充 center/radius/angle
    if ((!arcItem.center || !arcItem.radius) && pts.length >= 3) {
      arcItem.buildArcPointsBetween(pts[0], pts[1], pts[2], 8);
    }
    return arcItem;
  }

  // 获取圆心（可选方法）
  getCenter(): THREE.Vector3 | undefined {
    return this.center;
  }

  // 获取半径（可选方法）
  getRadius(): number | undefined {
    return this.radius;
  }

  // 获取角度范围（可选方法）
  getAngleRange(): { start: number; end: number } | undefined {
    if (this.startAngle === undefined || this.endAngle === undefined) {
      return undefined;
    }
    return { start: this.startAngle, end: this.endAngle };
  }

  static handleArcTool(app: any, manager: any, intersect: THREE.Vector3) {
    if (!manager.previewItem || !(manager.previewItem instanceof ArcItem)) {
      manager.previewItem = new ArcItem([intersect.clone()]);
    } else {
      const a = manager.previewItem as ArcItem;
      if (a.points.length === 1) a.points.push(intersect.clone());
      else if (a.points.length === 2) {
        a.points.push(intersect.clone());
        a.remove(app.scene);
        a.draw(app.scene);
        manager.sketchItems.value.push(a);
        manager.previewItem = null;
      }
    }
  }
}