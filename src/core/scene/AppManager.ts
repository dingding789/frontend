// AppManager.ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import SketchManager from '../managers/sketchManager/SketchManager'; // 导入 SketchManager
import { ExtrudeManager } from '../managers/featureManager/ExtrudeManager'; // 导入 ExtrudeManager
import { SceneLights } from './SceneLights';
import { SceneCamera } from './SceneCamera';
import { SceneRenderer } from './SceneRenderer';
import { SceneControls } from './SceneControls';
import { EventManager } from '../managers/eventManager/EventManager';
import MainModuleFactory, { MainModule } from '../../wasm/chili-wasm';
import { ensureWasm, getWasm } from '../../wasm/wasm';

interface AppManagerOptions {
  backgroundColor?: number;
  axesHelperSize?: number;
  gridHelperSize?: number;
  gridDivisions?: number;
  enableShadows?: boolean;
}


class AppManager {
  private static instance: AppManager;
  public sketchMgr: SketchManager
  public extrudeMgr: ExtrudeManager

  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: SceneControls;
  public eventManager: EventManager;
  /** 默认光源 */
  public ambientLight!: THREE.AmbientLight;
  public directionalLight!: THREE.DirectionalLight;
  private wasmPromise: Promise<MainModule | null> | null = null;
  /** 是否启用阴影 */
  private enableShadows: boolean;
  public needsRender = true; // 新增：场景是否需要渲染一次
  private constructor(options: AppManagerOptions = {}) {
    const {
      backgroundColor = 0x222222,
      axesHelperSize = 100,
      gridHelperSize = 200,
      gridDivisions = 20,
      enableShadows = true
    } = options;

    this.enableShadows = enableShadows;

    // 初始化场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(backgroundColor);

    // 初始化相机
    this.camera = new SceneCamera(window.innerWidth, window.innerHeight).instance;

    // 初始化渲染器
    this.renderer = new SceneRenderer(this.enableShadows).instance;
    document.body.appendChild(this.renderer.domElement);

    // 添加辅助线
    this.scene.add(new THREE.AxesHelper(axesHelperSize));
    this.scene.add(new THREE.GridHelper(gridHelperSize, gridDivisions, 0x444444, 0x888888));

    // 初始化控制器
    this.controls = new SceneControls(this.camera, this.renderer.domElement);

    this.sketchMgr = new SketchManager(this);
    this.extrudeMgr = new ExtrudeManager(this,this.sketchMgr);

    // 光源
    const lights = new SceneLights(this.enableShadows);
    this.ambientLight = lights.ambientLight;
    this.directionalLight = lights.directionalLight;
    this.scene.add(this.ambientLight);
    this.scene.add(this.directionalLight);
    // 事件管理器
    this.eventManager = new EventManager(this, this.sketchMgr, this.sketchMgr.sketchSession);
    this.eventManager.registerAll();
    this.eventManager.bindAll();
    // 绑定事件
    //this.bindEvents();
    // 启用拉伸交互（给画布绑定点击事件）
    this.ensureWasm();
  }


  
  /** 获取单例实例 */
  public static getInstance(options?: AppManagerOptions): AppManager {
    if (!AppManager.instance) {
      AppManager.instance = new AppManager(options);
    }
    return AppManager.instance;
  }

  public animate(callback: () => void): void {
    const loop = () => {
      requestAnimationFrame(loop);
      callback();
      // controls.update() 可放在 callback 内部，保证自定义逻辑优先
      if (this.needsRender || this.controls.needsRender) {
        this.renderer.render(this.scene, this.camera);
        this.needsRender = false;
        this.controls.needsRender = false;
      }
    };
    loop();
  }

  /** 手动刷新一次渲染 */
  public renderOnce(): void {
    this.renderer.render(this.scene, this.camera);
  }
  /** 窗口大小变化回调 */
  private onWindowResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  /** 绑定事件 */
  private bindEvents(): void {
    window.addEventListener('resize', this.onWindowResize);

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Shift') this.controls.instance.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    });

    window.addEventListener('keyup', (event) => {
      if (event.key === 'Shift') this.controls.instance.mouseButtons.MIDDLE = THREE.MOUSE.ROTATE;
    });
  }

  /** 创建默认材质（可用于网格、Brep模型等） */
  public createDefaultMaterial(color: number = 0x00ff00): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color,
      metalness: 0.3,
      roughness: 0.7
    });
  }
    private ensureWasm(): Promise<MainModule | null> {
    const cached = (this as any).wasm as MainModule | undefined;
    if (cached) return Promise.resolve(cached);
    if (this.wasmPromise) return this.wasmPromise;

    this.wasmPromise = MainModuleFactory()
      .then((mod: MainModule) => {
        (this as any).wasm = mod;
        return mod;
      })
      .catch((e: any) => {
        console.error('wasm 加载失败:', e);
        this.wasmPromise = null;
        return null;
      });

    return this.wasmPromise;
  }


}

export default AppManager;