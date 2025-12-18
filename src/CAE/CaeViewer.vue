<template>
  <div class="vtk-container" ref="vtkContainer">
    <div v-if="store.isProcessing" class="overlay-msg">
      <div class="spinner"></div>
      <div>{{ store.loadingText }}</div>
    </div>
    <div v-else-if="!store.modelUrl" class="overlay-msg">
      请点击右上角导入模型
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useCaeStore } from './useCaeStore';

// VTK 核心
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
import vtkSTLReader from '@kitware/vtk.js/IO/Geometry/STLReader';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';

const store = useCaeStore();
const vtkContainer = ref<HTMLElement | null>(null);

let genericRenderWindow: any = null;
let renderer: any = null;
let renderWindow: any = null;

onMounted(() => {
  initVtk();
  if (store.modelUrl) loadModel(store.modelUrl);
});

onBeforeUnmount(() => {
  if (genericRenderWindow) genericRenderWindow.delete();
});

// 监听 URL 变化自动加载
watch(() => store.modelUrl, (newUrl) => {
  if (newUrl) loadModel(newUrl);
});

function initVtk() {
  if (!vtkContainer.value) return;
  genericRenderWindow = vtkGenericRenderWindow.newInstance({
    background: [0.15, 0.2, 0.25], // 背景色
  });
  genericRenderWindow.setContainer(vtkContainer.value);
  genericRenderWindow.resize();
  renderer = genericRenderWindow.getRenderer();
  renderWindow = genericRenderWindow.getRenderWindow();
}

function loadModel(url: string) {
  if (!renderer) return;

  // 加上时间戳防止缓存
  const noCacheUrl = `${url}?t=${new Date().getTime()}`;
  console.log(`[CaeViewer] Loading: ${noCacheUrl} | Mode: ${store.viewMode}`);

  const reader = vtkSTLReader.newInstance();
  
  reader.setUrl(noCacheUrl).then(() => {
    reader.loadData().then(() => {
      const mapper = vtkMapper.newInstance();
      mapper.setInputConnection(reader.getOutputPort());
      
      const actor = vtkActor.newInstance();
      actor.setMapper(mapper);

      // === 根据 viewMode 决定显示风格 ===
      if (store.viewMode === 'mesh') {
        // 【网格模式】显示网格线
        actor.getProperty().setEdgeVisibility(true);
        actor.getProperty().setEdgeColor(0.2, 0.2, 0.2); // 黑灰色线
        actor.getProperty().setColor(0.7, 0.7, 0.7);     // 灰色面
        actor.getProperty().setSpecular(0);              // 减少反光，看清网格
      } else {
        // 【几何模式】隐藏网格线，显示光滑实体
        actor.getProperty().setEdgeVisibility(false);    // <--- 关键：隐藏线条
        actor.getProperty().setColor(0.9, 0.6, 0.3);     // 经典的 CAD 橙色/铜色
        actor.getProperty().setSpecular(0.5);            // 增加一点高光，更有立体感
        actor.getProperty().setSpecularPower(30);
      }
      
      renderer.removeAllActors();
      renderer.addActor(actor);
      renderer.resetCamera();
      renderWindow.render();
    }).catch((e: any) => console.error(e));
  });
}
</script>

<style scoped>
.vtk-container {
  width: 100%; height: 100%; position: absolute; top: 0; left: 0; background: #000;
}
.overlay-msg {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  color: white; background: rgba(0,0,0,0.7); padding: 20px; border-radius: 8px;
  text-align: center; pointer-events: none;
}
.spinner {
  border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white;
  border-radius: 50%; width: 30px; height: 30px; margin: 0 auto 10px;
  animation: spin 1s linear infinite;
}
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>