<template>
  <div ref="viewerContainer" class="viewer w-full h-full"></div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import * as THREE from 'three';
import SceneManager from '../../core/scene/AppManager';

const viewerContainer = ref<HTMLDivElement | null>(null);
let app: SceneManager | null = null;
let meshObj: THREE.Object3D | null = null;

let canvasEl: HTMLCanvasElement | null = null;
function preventContext(e: Event) { e.preventDefault(); }

/**
 * 左键用于选择（拦截到捕获阶段，防止 OrbitControls 响应）
 * 中键用于平移（由 OrbitControls 执行）
 * 右键用于旋转（由 OrbitControls 执行）
 */
function onPointerDownCapture(e: PointerEvent) {
  // 拦截左键（button === 0），防止 OrbitControls 响应拖动
  if (e.button === 0) {
    // 阻止后续对该事件的处理（包括 OrbitControls）
    e.stopImmediatePropagation();
    // 在此触发你的选择逻辑，例如射线拾取
    // (app as any)?.pickAtPointer?.(e.clientX, e.clientY);
    return;
  }
  // 其余按键不在此捕获处理，让 OrbitControls 处理（中键平移、右键旋转）
}

onMounted(async () => {
  app = SceneManager.getInstance();

  // 把 renderer.domElement 放入指定容器
  if (viewerContainer.value && app) {
    viewerContainer.value.appendChild(app.renderer.domElement);
    canvasEl = app.renderer.domElement as HTMLCanvasElement;
  }

  // 禁用浏览器默认右键菜单，防止右键旋转时弹出菜单
  if (canvasEl) {
    canvasEl.addEventListener('contextmenu', preventContext);
    // 在捕获阶段拦截左键，避免 OrbitControls 响应左键拖动
    canvasEl.addEventListener('pointerdown', onPointerDownCapture, { capture: true });
    // 禁用浏览器的触摸手势滚动等
    canvasEl.style.touchAction = 'none';
  }

  // 如果 AppManager 提供了 OrbitControls 实例，调整鼠标按键映射
  const anyApp: any = app as any;
  if (anyApp && anyApp.controls) {
    const controls = anyApp.controls as any;
    // 强制将中键映射为 PAN，右键映射为 ROTATE，左键不由 controls 处理
    try {
      controls.mouseButtons = {
        LEFT: -1,               // 禁用左键在 OrbitControls 的默认行为（我们在捕获阶段拦截）
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE
      };
      controls.enablePan = true;
      controls.enableRotate = true;
      controls.update?.();
    } catch (err) {
      // 若 controls 类型不符合，忽略并继续（回退不会抛出）
      console.warn('controls mouseButtons config failed', err);
    }
  }

  // 开启渲染循环
  app.animate(() => {
    // 可选：每帧逻辑
  });

  // 加载 mesh
  //const meshData = await loadMesh(`${API_BASE}/mesh`);

  // 添加到场景
  //app.scene.add(meshData);

  app.renderOnce();
});

onBeforeUnmount(() => {
  if (canvasEl) {
    canvasEl.removeEventListener('contextmenu', preventContext);
    canvasEl.removeEventListener('pointerdown', onPointerDownCapture, { capture: true } as any);
    canvasEl.style.touchAction = '';
    canvasEl = null;
  }

  // 移除 mesh
  if (meshObj && app) {
    app.scene.remove(meshObj);
    meshObj = null;
 }
});
</script>

<style scoped>
.viewer {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #1e1e1e;
}
</style>
