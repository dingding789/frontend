// CreateCircleCommand.ts
import * as THREE from 'three';
import { CreateCommand } from '../CreateCommand';
import { CircleItem, CircleMode, calcCircleBy3PointsOnPlane } from '../../geometry/sketchs/CircleItem';

export class CreateCircle extends CreateCommand {
  private mode: CircleMode;
  private planeNormal: THREE.Vector3;

  constructor(
    app: any,
    manager: any,
    mode: CircleMode = 'two-point',
    planeNormal: THREE.Vector3 = new THREE.Vector3(0, 0, 1)
  ) {
    super(app, manager);
    this.mode = mode;
    this.planeNormal = planeNormal.clone().normalize();
  }

  /** 鼠标点击 */
  onClick(point: THREE.Vector3): void {
    this.points.push(point.clone());
    // 首次点击后立刻创建并更新预览（事件里先 onMove 再 onClick 的顺序会导致首帧无预览）
    this.updatePreview(point);
    if (this.mode === 'two-point') {
      if (this.points.length === 2) {
        this.finish();
      }
    } else {
      // three-point
      if (this.points.length === 3) {
        this.finish();
      }
    }
  }

  /** 鼠标移动实时预览 */
  onMove(point: THREE.Vector3): void {
    this.updatePreview(point);
  }

  /** 是否完成全部点位输入 */
  isFinished(): boolean {
    return this.mode === 'two-point'
      ? this.points.length >= 2
      : this.points.length >= 3;
  }

  /** 生成最终 CircleItem */
  createItem(): any {
    if (!this.isFinished()) return null;

    if (this.mode === 'two-point') {
      const [p1, p2] = this.points;
      return new CircleItem('two-point', p1, p2, undefined, this.planeNormal);
    } else {
      const [p1, p2, p3] = this.points;
      return new CircleItem('three-point', p1, p2, p3, this.planeNormal);
    }
  }

  /** 绘制预览圆（修复三点画圆预览不显示） */
  updatePreview(cursorPoint: THREE.Vector3): void {
    // 若还没选点，先不画（首个点点击后会立即再次调用本方法）
    if (this.points.length === 0) return;

    if (!this.previewItem) {
      // 创建预览 CircleItem（注意三点模式不要把 point2 设成与 point1 相同）
      if (this.mode === 'two-point') {
        this.previewItem = new CircleItem('two-point', this.points[0], cursorPoint, undefined, this.planeNormal);
      } else {
        // 初始化三点模式时，为满足类型要求，先用光标作为第二、第三点的占位
        this.previewItem = new CircleItem('three-point', this.points[0], cursorPoint, cursorPoint, this.planeNormal);
      }
      this.manager.previewItem = this.previewItem;
    }

    const circle = this.previewItem as CircleItem;
    const p1 = this.points[0];
    // 将预览对象的点更新为“已选点 + 光标”
    if (this.mode === 'two-point') {
      circle.point1 = p1;
      circle.point2 = cursorPoint;
      circle.point3 = undefined;
    } else {
      if (this.points.length === 1) {
        // 仅首点：用光标作为第二点，让 drawPreview 至少能画出引导线
        circle.point1 = p1;
        circle.point2 = cursorPoint;
        circle.point3 = undefined;
      } else {
        const p2 = this.points[1];
        circle.point1 = p1;
        circle.point2 = p2;
        circle.point3 = cursorPoint;
      }
    }
    // 让 CircleItem 自己根据 point1/2/3 绘制预览
    circle.remove(this.app.scene);
    circle.drawPreview(this.app.scene, cursorPoint);
  }
}
