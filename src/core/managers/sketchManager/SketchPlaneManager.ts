import * as THREE from 'three';
import AppManager from '../../scene/SceneManager';

export class SketchPlaneManager {
  private app: AppManager;
  private planes: { mesh: THREE.Mesh; name: string }[] = [];
  private selectedPlane: THREE.Mesh | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private clickEnabled = false; // 是否允许点击选择

  constructor(app: AppManager) {
    this.app = app;
  }

  /** 创建三基平面 */
  createPlanes(): { mesh: THREE.Mesh; name: string }[] {
    const planeSize = 100;
    const createPlane = (color: number, rotation: [number, number, number], name: string) => {
      const mat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeSize, planeSize), mat);
      mesh.rotation.set(...rotation);
      mesh.name = name;
      this.app.scene.add(mesh);
      return mesh;
    };

    this.planes = [
      { mesh: createPlane(0x00ff00, [0, 0, 0], 'XY'), name: 'XY' },
      { mesh: createPlane(0xff0000, [0, Math.PI / 2, 0], 'YZ'), name: 'YZ' },
      { mesh: createPlane(0x0000ff, [-Math.PI / 2, 0, 0], 'XZ'), name: 'XZ' },
    ];

    this.app.renderOnce();
    return this.planes;
  }

  selectPlane(name: string): THREE.Plane | null {
  // 找到对应平面网格（用于获取世界位置）
  const planeEntry = this.planes.find(p => p.name === name);
  const mesh = planeEntry?.mesh || null;

  // 计算目标（以平面网格中心为目标，如果没有网格则退回原点）
  const target = new THREE.Vector3(0, 0, 0);
  if (mesh) mesh.getWorldPosition(target);

  // 根据平面类型设置摄像机位置与上方向（相对于目标）
  switch (name) {
    case 'XY':
      this.app.camera.position.copy(target.clone().add(new THREE.Vector3(0, 0, 200)));
      this.app.camera.up.set(0, 1, 0);
      break;
    case 'YZ':
      this.app.camera.position.copy(target.clone().add(new THREE.Vector3(200, 0, 0)));
      this.app.camera.up.set(0, 1, 0);
      break;
    case 'XZ':
      this.app.camera.position.copy(target.clone().add(new THREE.Vector3(0, 200, 0)));
      this.app.camera.up.set(0, 0, -1);
      break;
    default:
      return null;
  }

  // 归一化 up，确保正交性
  this.app.camera.up.normalize();

  // 如果存在 OrbitControls，同步 controls.target，并强制 update
  const anyApp: any = this.app as any;
  const controls = anyApp?.controls;
  if (controls && typeof controls.target !== 'undefined') {
    // 把 controls.target 对齐到平面中心（world position）
    controls.target.copy(target);
    // 如果 controls 有 update 方法，调用它使 camera 与 controls 一致
    controls.update?.();
  }

  // 让摄像机朝向目标
  this.app.camera.lookAt(target);

  // 保存选择的平面几何（mesh）并只保留选中的平面显示，移除其它平面
  this.selectedPlane = mesh || null;

  // 移除其它平面网格，仅保留被选中的一个（如果有）
  this.planes.filter(p => p.name !== name).forEach(p => {
    this.app.scene.remove(p.mesh);
  });
  // 保留选中平面在 this.planes 中，或清空为只含选中项
  this.planes = planeEntry ? [planeEntry] : [];

  // 计算并返回与网格位置一致的 THREE.Plane（通过法向和一个共面点）
  const normal =
    name === 'XY' ? new THREE.Vector3(0, 0, 1) :
    name === 'YZ' ? new THREE.Vector3(1, 0, 0) :
                    new THREE.Vector3(0, 1, 0);

  const thrPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal.clone().normalize(), target);
  return thrPlane;
}

  /** 点击选平面逻辑 */
  private onClick = (event: MouseEvent) => {
    if (!this.clickEnabled) return;

    const rect = this.app.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.app.camera);
    const intersects = this.raycaster.intersectObjects(this.planes.map(p => p.mesh));
    if (intersects.length > 0) {
      const hit = intersects[0].object as THREE.Mesh;
      this.selectPlane(hit.name);
      console.log(`[SketchPlaneManager] 选中平面: ${hit.name}`);
    }
  };

  /** 启用点击选择功能 */
  enableClickSelect() {
    if (!this.clickEnabled) {
      this.clickEnabled = true;
      this.app.renderer.domElement.addEventListener('click', this.onClick);
    }
  }

  /** 禁用点击选择功能 */
  disableClickSelect() {
    if (this.clickEnabled) {
      this.clickEnabled = false;
      this.app.renderer.domElement.removeEventListener('click', this.onClick);
    }
  }

  /** 获取当前选中的 THREE.Plane（用于几何计算） */
  getCurrentTHREEPlane(): THREE.Plane | null {
    if (!this.selectedPlane) return null;

    switch (this.selectedPlane.name) {
      case 'XY':
        return new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      case 'YZ':
        return new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
      case 'XZ':
        return new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      default:
        return null;
    }
  }

  /** 移除所有平面 */
  removeAll() {
    this.disableClickSelect();
    this.planes.forEach(p => this.app.scene.remove(p.mesh));
    this.planes = [];
    this.selectedPlane = null;
    this.app.renderOnce();
  }
}