<template>
  <div class="vtk-container" ref="vtkContainer">
    <div v-if="store.isProcessing" class="overlay-msg">
      <div class="spinner"></div>
      <div>{{ store.loadingText }}</div>
    </div>
    <div v-else-if="!store.modelUrl" class="overlay-msg">请点击右上角导入模型</div>

    <div class="bc-list-panel" v-if="store.boundaryConditions.length > 0 && store.viewMode !== 'result'">
      <h4>边界条件</h4>
      <ul>
        <li v-for="bc in store.boundaryConditions" :key="bc.id">
          <span class="tag" :class="bc.type">{{ bc.type }}</span> {{ bc.name }}
        </li>
      </ul>
    </div>

    <div class="result-controls" v-if="store.viewMode === 'result'">
      <h4>结果可视化</h4>

      <div class="control-item">
        <label>
          <input type="checkbox" v-model="showEdges" @change="applyEdgeVisibility" /> 显示边线
        </label>
      </div>

      <div class="legend-box">
        <div class="colorbar"></div>
        <div class="labels">
          <span>{{ dataRange[1].toFixed(2) }}</span>
          <span>{{ dataRange[0].toFixed(2) }}</span>
        </div>
      </div>
      <div style="font-size:10px; color:#666; margin-top:5px;">当前数据: {{ activeArrayName }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useCaeStore } from './useCaeStore';

// --- VTK 核心依赖 ---
import '@kitware/vtk.js/Rendering/Profiles/Geometry';
import vtkGenericRenderWindow from '@kitware/vtk.js/Rendering/Misc/GenericRenderWindow';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';

// --- VTK 读取器 ---
import vtkSTLReader from '@kitware/vtk.js/IO/Geometry/STLReader';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import vtkPolyDataReader from '@kitware/vtk.js/IO/Legacy/PolyDataReader';
import { parseVtuToPolyData } from './parseVtu';

const store = useCaeStore();
const vtkContainer = ref<HTMLElement | null>(null);

// VTK 对象 (不使用 ref/reactive 避免性能问题)
let genericRenderWindow: any = null;
let renderer: any = null;
let renderWindow: any = null;
let currentActor: any = null; // 保存当前 Actor 以便切换边线

// 响应式状态
const dataRange = ref([0, 0]);
const activeArrayName = ref("无");
const showEdges = ref(true);

// 生命周期
onMounted(() => { 
  initVtk(); 
  if (store.modelUrl) loadModel(store.modelUrl); 
});

onBeforeUnmount(() => { 
  if (genericRenderWindow) {
    genericRenderWindow.delete();
    genericRenderWindow = null;
  }
});

// 监听模型 URL 变化
watch(() => store.modelUrl, (url) => { 
  if (url) loadModel(url); 
});

// 初始化 VTK 窗口
function initVtk() {
  if (!vtkContainer.value) return;
  genericRenderWindow = vtkGenericRenderWindow.newInstance({ background: [0.15, 0.2, 0.25] });
  genericRenderWindow.setContainer(vtkContainer.value);
  genericRenderWindow.resize();
  renderer = genericRenderWindow.getRenderer();
  renderWindow = genericRenderWindow.getRenderWindow();
}

// 加载模型主逻辑
function loadModel(url: string) {
  if (!renderer) return;
  
  // 1. URL 规范化 & 缓存清理
  let normalizedUrl = url;
  if (normalizedUrl.startsWith('/static/')) {
    normalizedUrl = `http://localhost:8000${normalizedUrl}`;
  }
  const noCacheUrl = `${normalizedUrl}?t=${Date.now()}`;
  console.log(`[Viewer] Loading: ${noCacheUrl}`);

  const lowerUrl = url.toLowerCase();

  // 2. 根据后缀选择策略
  if (lowerUrl.endsWith('.stl')) {
    // STL 读取逻辑
    const reader = vtkSTLReader.newInstance();
    reader.setUrl(noCacheUrl).then(() => {
      reader.loadData().then(() => {
        renderMesh(reader);
      });
    });
  } 
  else if (lowerUrl.endsWith('.vtu')) {
    // VTU: 用 vtkXMLReader 自动处理 binary/zlib (参考 frd-viewer)
    fetch(noCacheUrl)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const buf = await r.arrayBuffer();
        console.log(`[VTU] fetched bytes: ${buf.byteLength}`);
        const polyData = await parseVtuToPolyData(buf);
        if (!polyData) throw new Error('VTU parsed as null');

        console.log('[VTU] Creating mapper and actor...');
        const mapper = vtkMapper.newInstance();
        const actor = vtkActor.newInstance();

        // 直接设置 polyData 到 mapper，不经过滤镜
        mapper.setInputData(polyData);
        actor.setMapper(mapper);

        const scalars = polyData.getPointData().getScalars();
        const bounds = polyData.getBounds();
        console.log(
          '[VTU] polyData bounds:',
          bounds,
          'points:',
          polyData.getNumberOfPoints(),
          'polys:',
          polyData.getNumberOfPolys(),
          'scalars:',
          !!scalars
        );

        if (scalars) {
          activeArrayName.value = `${scalars.getName()} (PointData)`;
          const range = scalars.getRange();
          console.log('[VTU] scalar range:', range);
          dataRange.value = range;

          // 应用 LUT 着色
          const lut = vtkColorTransferFunction.newInstance();
          lut.addRGBPoint(range[0], 0.0, 0.0, 1.0);
          lut.addRGBPoint(range[0] + (range[1] - range[0]) * 0.5, 0.0, 1.0, 0.0);
          lut.addRGBPoint(range[1], 1.0, 0.0, 0.0);
          mapper.setLookupTable(lut);
          mapper.setUseLookupTableScalarRange(true);
          mapper.setScalarVisibility(true);
          console.log('[VTU] LUT applied');
        } else {
          // Fallback: no scalars, use gray color
          console.log('[VTU] No scalars, using default color');
          actor.getProperty().setColor(0.9, 0.9, 0.9);
        }

        // 配置 Actor 属性
        actor.getProperty().setInterpolationToPhong();
        actor.getProperty().setAmbient(0.3);
        actor.getProperty().setDiffuse(0.6);
        actor.getProperty().setSpecular(0.0);

        if (polyData.getNumberOfPolys() > 0) {
          actor.getProperty().setRepresentationToSurface();
          actor.getProperty().setEdgeVisibility(showEdges.value);
          actor.getProperty().setEdgeColor(0, 0, 0);
        } else {
          actor.getProperty().setRepresentationToPoints();
          actor.getProperty().setPointSize(3);
        }

        currentActor = actor;
        resetRenderer(actor);
        console.log('[VTU] VTU rendering complete');
      })
      .catch((e) => {
        console.error('[VTU] parse failed', e);
        alert('VTU 解析失败');
      });
  }
  else if (lowerUrl.endsWith('.vtp')) {
    const reader = vtkXMLPolyDataReader.newInstance();
    reader.setUrl(noCacheUrl).then(() => {
      reader.loadData().then(() => {
        renderResult(reader);
      });
    });
  }
  else if (lowerUrl.endsWith('.vtk')) {
    const reader = vtkPolyDataReader.newInstance();
    reader.setUrl(noCacheUrl).then(() => {
      reader.loadData().then(() => {
        renderResult(reader);
      });
    });
  }
}

// --- 渲染普通网格 (无结果) ---
function renderMesh(reader: any) {
  const mapper = vtkMapper.newInstance();
  const actor = vtkActor.newInstance();
  
  mapper.setInputConnection(reader.getOutputPort());
  
  if (store.viewMode === 'mesh') {
    actor.getProperty().setEdgeVisibility(true);
    actor.getProperty().setEdgeColor(0,0,0);
    actor.getProperty().setColor(0.9, 0.95, 1.0);
  } else {
    actor.getProperty().setEdgeVisibility(false);
    actor.getProperty().setColor(0.9, 0.6, 0.3);
  }
  
  actor.setMapper(mapper);
  currentActor = actor;
  
  resetRenderer(actor);
}

// --- 渲染仿真结果 (带云图/变形) ---
function renderResult(reader: any) {
  const mapper = vtkMapper.newInstance();
  const actor = vtkActor.newInstance();
  
  // 获取数据信息
  const output = reader.getOutputData(); 
  const pointData = output.getPointData();
  const cellData = output.getCellData();
  
  let scalars = pointData.getScalars();
  let foundSource = "PointData";

  // 如果没有默认标量，尝试查找第一个数组
  if (!scalars && pointData.getNumberOfArrays() > 0) {
      scalars = pointData.getArrayByIndex(0);
      pointData.setScalars(scalars);
  }
  // 如果 PointData 没有，找 CellData
  if (!scalars && cellData.getNumberOfArrays() > 0) {
      scalars = cellData.getArrayByIndex(0);
      cellData.setScalars(scalars);
      foundSource = "CellData";
  }

  if (scalars) {
    activeArrayName.value = `${scalars.getName()} (${foundSource})`;
    const range = scalars.getRange();
    dataRange.value = range;
    
    // 设置颜色映射表 (蓝 -> 绿 -> 红)
    const lut = vtkColorTransferFunction.newInstance();
    lut.addRGBPoint(range[0], 0.0, 0.0, 1.0); 
    lut.addRGBPoint(range[0] + (range[1]-range[0])*0.5, 0.0, 1.0, 0.0);
    lut.addRGBPoint(range[1], 1.0, 0.0, 0.0);
    
    mapper.setLookupTable(lut);
    mapper.setUseLookupTableScalarRange(true);
    mapper.setInputConnection(reader.getOutputPort());
  } else {
    activeArrayName.value = "未找到数据";
    mapper.setInputConnection(reader.getOutputPort());
  }

  // 设置 Actor 属性
  applyEdgeVisibilityToActor(actor);
  
  actor.setMapper(mapper);
  currentActor = actor;
  
  resetRenderer(actor);
}

// 辅助：重置场景
function resetRenderer(actor: any) {
  renderer.removeAllActors();
  renderer.addActor(actor);
  // 渲染器相机重置与裁剪范围调整
  const cam = renderer.getActiveCamera();
  const beforePos = cam.getPosition();
  const beforeFp = cam.getFocalPoint();
  const beforeCr = cam.getClippingRange();
  const sceneBounds = renderer.computeVisiblePropBounds();
  console.log('[VTU] resetRenderer: before camera', { position: beforePos, focalPoint: beforeFp, clippingRange: beforeCr }, 'bounds:', sceneBounds);

  renderer.resetCamera();
  renderer.resetCameraClippingRange();

  const afterPos = cam.getPosition();
  const afterFp = cam.getFocalPoint();
  const afterCr = cam.getClippingRange();
  console.log('[VTU] resetRenderer: after camera', { position: afterPos, focalPoint: afterFp, clippingRange: afterCr });

  renderWindow.render();
}

// 应用边线可见性 (Checkbox 触发)
function applyEdgeVisibility() {
  if (currentActor) {
    applyEdgeVisibilityToActor(currentActor);
    renderWindow.render();
  }
}

// 设置 Actor 的边线属性
function applyEdgeVisibilityToActor(actor: any) {
  actor.getProperty().setEdgeVisibility(showEdges.value);
  actor.getProperty().setEdgeColor(0, 0, 0);
  actor.getProperty().setLineWidth(1);
}
</script>

<style scoped>
.vtk-container { width: 100%; height: 100%; position: absolute; background: #000; }
.overlay-msg { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); color: white; background: rgba(0,0,0,0.7); padding: 20px; border-radius: 8px; z-index: 10; }
.spinner { border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white; border-radius: 50%; width: 30px; height: 30px; margin: 0 auto 10px; animation: spin 1s linear infinite; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.result-controls {
  position: absolute; bottom: 20px; right: 20px;
  background: rgba(255, 255, 255, 0.9); padding: 15px;
  border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  display: flex; flex-direction: column; gap: 10px; min-width: 160px;
  z-index: 5;
}
.result-controls h4 { margin: 0; font-size: 14px; text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
.control-item { display: flex; flex-direction: column; font-size: 12px; }
.legend-box { display: flex; gap: 8px; margin-top: 5px; }
.colorbar { width: 15px; height: 120px; background: linear-gradient(to top, blue, green, red); border: 1px solid #ccc; }
.labels { display: flex; flex-direction: column; justify-content: space-between; height: 120px; font-size: 10px; font-weight: bold; }

.bc-list-panel {
  position: absolute; top: 20px; left: 20px;
  background: rgba(255, 255, 255, 0.9); padding: 10px;
  border-radius: 8px; pointer-events: none;
}
.bc-list-panel h4 { margin: 0 0 5px 0; font-size: 14px; }
.bc-list-panel ul { list-style: none; padding: 0; margin: 0; font-size: 12px; }
.tag { padding: 2px 4px; border-radius: 4px; color: white; margin-right: 5px; }
.tag.fixed { background: #e74c3c; }
.tag.force { background: #3498db; }
</style>