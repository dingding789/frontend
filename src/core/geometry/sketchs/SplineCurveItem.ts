// SplineCurveItem.ts
import * as THREE from 'three';
import { SketchItem } from './SketchItem';

export class SplineCurveItem extends SketchItem {
  public points: THREE.Vector3[] = [];
  public tension = 0.5;
  public closed = false;
  public segments = 128;

  private handlesGroup: THREE.Group | null = null;
  private handleSize = 1.2;
  private handleColor = 0x00ffff;
  private handlesVisible = true; // 控制点可见性（会序列化/反序列化）

  constructor(firstPoint?: THREE.Vector3) {
    super('spline');
    if (firstPoint) this.points.push(firstPoint.clone());
  }

  // ------------------------------------------
  // 构建样条点集
  private buildCurvePoints(extraPoint?: THREE.Vector3): THREE.Vector3[] | null {
    const pts = this.points.slice();
    if (extraPoint) pts.push(extraPoint.clone());
    if (pts.length < 2) return null;

    const curve = new THREE.CatmullRomCurve3(pts, this.closed, 'catmullrom', this.tension);
    return curve.getPoints(this.segments);
  }

  // ------------------------------------------
  // 更新线条几何
  private updateLineGeometry() {
    if (!this.object3D || !(this.object3D as any).isLine) return;
    const line = this.object3D as THREE.Line;
    let geom = line.geometry as THREE.BufferGeometry;

    const pts = this.buildCurvePoints();
    if (!pts) return;

    const needCount = pts.length;
    let posAttr = geom.getAttribute('position') as THREE.BufferAttribute | undefined;

    if (!posAttr || posAttr.count !== needCount) {
      // 顶点数量变化，重建 geometry
      geom.dispose();
      geom = new THREE.BufferGeometry().setFromPoints(pts);
      line.geometry = geom;
      if ((line as any).isLineSegments === false && (line.material as any).isLineDashedMaterial) {
        (line as any).computeLineDistances?.();
      }
    } else {
      // 数量一致，仅更新数组数据
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < needCount; i++) {
        const p = pts[i];
        arr[i * 3 + 0] = p.x;
        arr[i * 3 + 1] = p.y;
        arr[i * 3 + 2] = p.z;
      }
      posAttr.needsUpdate = true;
      geom.computeBoundingSphere?.();
    }
  }

 
  // 删除线条与句柄
  remove(scene: THREE.Scene) {
    if (this.object3D) {
      scene.remove(this.object3D);
      (this.object3D as any).geometry?.dispose?.();
      (this.object3D as any).material?.dispose?.();
      this.object3D = undefined as any;
    }
    this.clearHandles(scene);
  }


  // 清空句柄
  private clearHandles(scene: THREE.Scene) {
    if (!this.handlesGroup) return;
    for (const child of [...this.handlesGroup.children]) {
      const m = child as THREE.Mesh;
      (m.geometry as any)?.dispose?.();
      (m.material as any)?.dispose?.();
    }
    scene.remove(this.handlesGroup);
    this.handlesGroup = null;
  }

 
  // 确保句柄组存在
  private ensureHandlesGroup(scene: THREE.Scene) {
    if (!this.handlesGroup) {
      this.handlesGroup = new THREE.Group();
      this.handlesGroup.name = 'SplineHandles';
      scene.add(this.handlesGroup);
    }
  }

 
  // 重建句柄，关于线条圆点的显示
  private rebuildHandles(scene: THREE.Scene, points: THREE.Vector3[]) {
    this.clearHandles(scene);
    this.ensureHandlesGroup(scene);
    const geo = new THREE.SphereGeometry(this.handleSize, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: this.handleColor });
    points.forEach((p, idx) => {
      const mesh = new THREE.Mesh(geo.clone(), mat.clone());
      mesh.position.copy(p);
      mesh.userData = { isSplineHandle: true, owner: this, index: idx };
      this.handlesGroup!.add(mesh);
    });
    // 根据持久化的开关控制显示
    this.handlesGroup!.visible = !!this.handlesVisible;
  }


  // 命中测试：返回所有句柄对象
  getHandleObjects(): THREE.Object3D[] {
    return this.handlesGroup ? [...this.handlesGroup.children] : [];
  }


  // 设置控制点可见性（不销毁，只隐藏/显示），同时更新内部 flag
  setHandlesVisible(visible: boolean) {
    this.handlesVisible = !!visible;
    if (this.handlesGroup) {
      this.handlesGroup.visible = this.handlesVisible;
    }
  }

  // ------------------------------------------
  // 新增：静态方法 - 批量设置所有样条的控制点可见性（供对话框调用）
  static setAllHandlesVisible(manager: any, visible: boolean, scene?: THREE.Scene) {
    const items = (manager?.sketchItems?.value ?? []) as any[];
    for (const item of items) {
      if (item instanceof SplineCurveItem) {
        item.setHandlesVisible(visible);
      }
    }
    if (manager?.previewItem instanceof SplineCurveItem) {
      manager.previewItem.setHandlesVisible(visible);
    }

    // 若外部传入 scene 或 manager/app 提供 renderOnce，则触发一次刷新
    const targetAppScene = scene ?? (manager?.app?.scene) ?? undefined;
    if ((manager?.app?.renderOnce || (manager?.renderOnce)) && targetAppScene) {
      (manager?.app?.renderOnce ?? manager?.renderOnce).call(manager?.app ?? manager);
    }
  }

  // ------------------------------------------
  // 新增：由对话框调用 - 隐藏所有控制点并退出样条工具
  // - 隐藏所有句柄
  // - 将 previewItem 落地（若已确认 >=2 点）或丢弃
  // - 将当前工具切回 'select'（或通过 manager.sketchSession.setTool）
  static finishAndExitTool(app: any, manager: any) {
    // 隐藏所有句柄（优先使用 app.scene）
    SplineCurveItem.setAllHandlesVisible(manager, false, app?.scene);

    // 处理预览项：若为样条 preview，则落地或丢弃
    if (manager?.previewItem instanceof SplineCurveItem) {
      const previewSpline = manager.previewItem as SplineCurveItem;
      if (previewSpline.points.length >= 2) {
        previewSpline.remove(app.scene);
        previewSpline.draw(app.scene);
        manager.sketchItems.value.push(previewSpline);
      } else {
        previewSpline.remove(app.scene);
      }
      manager.previewItem = null;
    }

    // 退出样条工具：尝试通过常见接口恢复到选择工具
    if (manager?.sketchSession?.setTool) {
      manager.sketchSession.setTool('select');
    } else if (manager?.setTool) {
      manager.setTool('select');
    } else if (app?.sketchMgr?.sketchSession?.setTool) {
      app.sketchMgr.sketchSession.setTool('select');
    }

    app?.renderOnce?.();
  }

  // ------------------------------------------
  // 设置控制点并更新几何
  setPoint(index: number, pos: THREE.Vector3, scene: THREE.Scene) {
    if (index < 0 || index >= this.points.length) return;

    this.points[index].copy(pos);

    if (!this.object3D) {
      this.draw(scene);
      return;
    }

    this.updateLineGeometry();

    if (this.handlesGroup && this.handlesGroup.children[index]) {
      (this.handlesGroup.children[index] as THREE.Mesh).position.copy(pos);
    }
  }

  // ------------------------------------------
  // 绘制最终样条
  draw(scene: THREE.Scene) {
    this.remove(scene);
    const pts = this.buildCurvePoints();
    if (!pts) return;

    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffff });
    const line = new THREE.Line(geom, mat);
    line.userData.isSketchItem = true;
    this.object3D = line;
    scene.add(line);

    this.rebuildHandles(scene, this.points);
  }

  // ------------------------------------------
  // 绘制预览样条
  drawPreview(scene: THREE.Scene, cursorPos?: THREE.Vector3) {
    this.remove(scene);
    const pts = this.buildCurvePoints(cursorPos);
    if (!pts) return;

    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineDashedMaterial({ color: 0x00ffff, dashSize: 1, gapSize: 0.5 });
    const line = new THREE.Line(geom, mat);
    line.computeLineDistances();
    line.userData.isSketchItem = true;
    this.object3D = line;
    scene.add(line);

    this.rebuildHandles(scene, this.points);
  }

  // ------------------------------------------
  // 序列化：包含句柄可见性，便于刷新后保持隐藏/显示状态
  toJSON() {
    return {
      type: 'spline',
      tension: this.tension,
      closed: this.closed,
      segments: this.segments,
      points: this.points.map(p => p.toArray()),
      handlesVisible: !!this.handlesVisible
    };
  }

  // ------------------------------------------
  // 反序列化：恢复 handlesVisible
  static fromJSON(data: any): SplineCurveItem {
    const item = new SplineCurveItem();
    if (Array.isArray(data.points)) {
      item.points = data.points.map((arr: number[]) => new THREE.Vector3(arr[0], arr[1], arr[2]));
    }
    if (typeof data.tension === 'number') item.tension = data.tension;
    if (typeof data.closed === 'boolean') item.closed = data.closed;
    if (typeof data.segments === 'number') item.segments = data.segments;
    if (typeof data.handlesVisible === 'boolean') {
      item.handlesVisible = data.handlesVisible;
    }
    return item;
  }

  // ------------------------------------------
  setTension(t: number) { this.tension = t; }
  setClosed(c: boolean) { this.closed = c; }

  // 新增：静态交互逻辑入口
  
  // 统一处理样条工具交互（由外部事件驱动）
  static handleSplineTool(
    app: any,
    manager: any,
    intersectionPoint: THREE.Vector3 | null,
    mode: 'add' | 'preview' | 'finish' | 'cancel'
  ) {
    const previewSpline = manager.previewItem instanceof SplineCurveItem
      ? (manager.previewItem as SplineCurveItem)
      : null;

    if (mode === 'cancel') {
      // 取消“最后一段预览”：
      // - 若已确认点数 >= 2，则将当前预览样条落地（仅包含已确认的段），并清空预览
      // - 若不足 2 点，则丢弃预览
      if (previewSpline) {
        if (previewSpline.points.length >= 2) {
          previewSpline.remove(app.scene);
          previewSpline.draw(app.scene);                 // 落地为实线
          manager.sketchItems.value.push(previewSpline); // 保存到草图项
        } else {
          previewSpline.remove(app.scene);               // 不足 2 点，丢弃
        }
        manager.previewItem = null;
        app?.renderOnce?.();
      }
      return;
    }

    if (mode === 'add') {
      if (!intersectionPoint) return;
      if (!previewSpline) {
        // 首次点击：仅创建，不立即用同点预览，避免零长度段不可见
        manager.previewItem = new SplineCurveItem(intersectionPoint.clone());
      } else {
        // 追加已确认点
        previewSpline.points.push(intersectionPoint.clone());
        if (previewSpline.points.length >= 2) {
          previewSpline.drawPreview(app.scene); // 展示已确认的段，下一段由 preview 驱动
        }
      }
      app?.renderOnce?.();
      return;
    }

    if (mode === 'preview') {
      if (previewSpline && intersectionPoint) {
        previewSpline.drawPreview(app.scene, intersectionPoint); // 用光标点预览下一段
        app?.renderOnce?.();
      }
      return;
    }

    if (mode === 'finish') {
      if (!previewSpline) return;
      if (previewSpline.points.length >= 2) {
        previewSpline.remove(app.scene);
        previewSpline.draw(app.scene);                   // 落地为实线
        manager.sketch.items.push(previewSpline);   // 保存
      } else {
        previewSpline.remove(app.scene);                 // 不足 2 点，丢弃
      }
      manager.previewItem = null;
      app?.renderOnce?.();
      return;
    }
  }
}
