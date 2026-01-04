<template>
  <div class="vtk-container" ref="vtkContainer" @click="handleCanvasClick">
    <div v-if="store.isProcessing" class="overlay-msg">
      <div class="spinner"></div>
      <div>{{ store.loadingText }}</div>
    </div>
    <div v-else-if="!store.modelUrl" class="overlay-msg">请点击右上角导入模型</div>

    <div v-if="store.isSelectingFace" class="selection-hint">
      点击模型表面选择面 | <button @click="cancelFaceSelection">取消</button>
    </div>

    <div class="bc-list-panel" v-if="store.boundaryConditions.length > 0 && store.viewMode !== 'result'">
      <h4>边界条件</h4>
      <ul>
        <li v-for="bc in store.boundaryConditions" :key="bc.id">
          <span class="tag" :class="bc.type">{{ bc.type }}</span> {{ bc.name }}
        </li>
      </ul>
    </div>

    <div
      class="result-controls"
      v-if="store.viewMode === 'result'"
      @pointerdown.stop
      @pointermove.stop
      @pointerup.stop
      @wheel.stop
      @mousedown.stop
      @mousemove.stop
      @mouseup.stop
      @touchstart.stop
      @touchmove.stop
      @touchend.stop
    >
      <h4>结果可视化</h4>

      <div class="control-item">
        <label>
          <input type="checkbox" v-model="showEdges" @change="applyEdgeVisibility" /> 显示边线
        </label>
      </div>

      <div class="control-item" v-if="hasDisplacementVector">
        <label>变形程度: {{ deformationPercent.toFixed(2) }}%</label>
        <input
          type="range"
          min="0"
          :max="deformationScaleMax"
          step="0.1"
          v-model.number="deformationScale"
          @input.stop="onDeformationScaleInput"
          @change.stop="onDeformationScaleInput"
        />
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
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
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
import vtkCellPicker from '@kitware/vtk.js/Rendering/Core/CellPicker';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';
import { parseVtuToPolyData } from './parseVtu';
import { createAxisIndicator, removeAxisIndicator, type AxisWidgetHandle } from './axisHelper';

const store = useCaeStore();
const vtkContainer = ref<HTMLElement | null>(null);

// VTK 对象 (不使用 ref/reactive 避免性能问题)
let genericRenderWindow: any = null;
let renderer: any = null;
let renderWindow: any = null;
let interactor: any = null;
let currentActor: any = null; // 保存当前 Actor 以便切换边线
let picker: any = null; // VTK picker 用于射线交叉测试
let currentPolyData: any = null; // 保存当前 PolyData 以便修改标量
let originalScalars: any = null; // 保存原始的标量值
let highlightLut: any = null; // 选面时使用的LUT
let axisGroup: AxisWidgetHandle | null = null; // 左下角坐标轴

// 响应式状态
const dataRange = ref([0, 0]);
const activeArrayName = ref("无");
const showEdges = ref(true);
const deformationScale = ref(1);
const hasDisplacementVector = ref(false);
const deformationScaleMax = ref(200);
const deformationMaxDispMag = ref(0);
const deformationBoundsDiag = ref(0);
const deformationPercentMax = ref(30);

const deformationPercent = computed(() => {
  const diag = deformationBoundsDiag.value;
  const maxU = deformationMaxDispMag.value;
  const s = deformationScale.value;
  if (!Number.isFinite(diag) || diag <= 0) return 0;
  if (!Number.isFinite(maxU) || maxU <= 0) return 0;
  if (!Number.isFinite(s) || s <= 0) return 0;
  return (s * maxU * 100) / diag;
});

type DeformationState = {
  polyData: any;
  basePoints: Float32Array;
  displacement: Float32Array;
  maxDispMag: number;
  boundsDiag: number;
};

let deformationState: DeformationState | null = null;

// 生命周期
onMounted(() => { 
  initVtk(); 
  setupFaceHighlightListener();
  if (store.modelUrl) loadModel(store.modelUrl);
});

onBeforeUnmount(() => { 
  if (axisGroup) {
    removeAxisIndicator(axisGroup);
    axisGroup = null;
  }
  if (genericRenderWindow) {
    genericRenderWindow.delete();
    genericRenderWindow = null;
  }
});

// 监听模型 URL 变化
watch(() => store.modelUrl, (url) => { 
  if (url) loadModel(url); 
});

watch(deformationScale, (scale) => {
  applyDeformationScale(scale);
});

// 初始化 VTK 窗口
function initVtk() {
  if (!vtkContainer.value) return;
  genericRenderWindow = vtkGenericRenderWindow.newInstance({ background: [0.15, 0.2, 0.25] });
  genericRenderWindow.setContainer(vtkContainer.value);
  genericRenderWindow.resize();
  renderer = genericRenderWindow.getRenderer();
  renderWindow = genericRenderWindow.getRenderWindow();
  interactor = genericRenderWindow.getInteractor?.() || null;
  
  // 初始化左下角坐标轴（VTK 官方 OrientationMarkerWidget + 文本标签）
  try {
    axisGroup = createAxisIndicator(interactor);
  } catch (e) {
    console.warn('[Viewer] Axis init failed:', e);
    axisGroup = null;
  }
  
  // 初始化 picker 用于面选择
  picker = vtkCellPicker.newInstance();
  picker.setTolerance(0.0025);
}

function onDeformationScaleInput(e: Event) {
  const el = e.target as HTMLInputElement | null;
  const v = el ? Number(el.value) : deformationScale.value;
  if (Number.isFinite(v)) {
    deformationScale.value = v;
    applyDeformationScale(v);
  }
}

// 统一的网格阶段外观（灰色+边线）
function applyGreyMaterial(actor: any) {
  actor.getProperty().setColor(0.9, 0.95, 1.0);
  actor.getProperty().setAmbient(0.3);
  actor.getProperty().setDiffuse(0.6);
  actor.getProperty().setEdgeVisibility(true);
  actor.getProperty().setEdgeColor(0, 0, 0);
  const mapper = actor.getMapper?.();
  if (mapper) {
    mapper.setScalarVisibility(false);
  }
}

function ensureHighlightLut() {
  if (!highlightLut) {
    highlightLut = vtkColorTransferFunction.newInstance();
    // 0 -> 灰色, 1 -> 红色
    highlightLut.addRGBPoint(0.0, 0.9, 0.95, 1.0);
    highlightLut.addRGBPoint(1.0, 1.0, 0.0, 0.0);
    // 固定映射范围 0..1
    if (highlightLut.setMappingRange) {
      highlightLut.setMappingRange(0.0, 1.0);
    }
  }
  return highlightLut;
}

// 加载模型主逻辑
function loadModel(url: string) {
  if (!renderer) return;
  clearDeformationState();
  
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

        if (store.viewMode === 'result' && scalars) {
          activeArrayName.value = `${scalars.getName()} (PointData)`;
          const range = scalars.getRange();
          console.log('[VTU] scalar range:', range);
          dataRange.value = range;

          const lut = vtkColorTransferFunction.newInstance();
          lut.addRGBPoint(range[0], 0.0, 0.0, 1.0);
          lut.addRGBPoint(range[0] + (range[1] - range[0]) * 0.5, 0.0, 1.0, 0.0);
          lut.addRGBPoint(range[1], 1.0, 0.0, 0.0);
          mapper.setLookupTable(lut);
          mapper.setUseLookupTableScalarRange(true);
          mapper.setScalarVisibility(true);
          console.log('[VTU] LUT applied for result view');
        } else {
          // 网格阶段强制灰色，不显示标量
          console.log('[VTU] Mesh view -> grey material');
          applyGreyMaterial(actor);
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
        currentPolyData = polyData; // 保存 polyData 用于高亮
        originalScalars = scalars || null; // 保存原始标量（可能为空）
        trySetupDeformation(polyData);
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
  currentPolyData = reader.getOutputData(); // 保存 polyData 用于高亮
  clearDeformationState();
  
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
    mapper.setInputData(output);
  } else {
    activeArrayName.value = "未找到数据";
    mapper.setInputData(output);
  }

  // 设置 Actor 属性
  applyEdgeVisibilityToActor(actor);
  
  actor.setMapper(mapper);
  currentActor = actor;
  currentPolyData = output;
  originalScalars = scalars || null;
  trySetupDeformation(output);
  
  resetRenderer(actor);
}

function clearDeformationState() {
  deformationState = null;
  hasDisplacementVector.value = false;
  deformationScaleMax.value = 200;
  deformationMaxDispMag.value = 0;
  deformationBoundsDiag.value = 0;
}

function trySetupDeformation(polyData: any) {
  clearDeformationState();
  if (!polyData?.getPoints?.() || !polyData?.getPointData?.()) return;

  const pointData = polyData.getPointData();
  let displacementArray: any = null;

  if (pointData.getArrayByName) {
    displacementArray = pointData.getArrayByName('Displacement');
  }
  if (!displacementArray && pointData.getVectors) {
    displacementArray = pointData.getVectors();
  }

  const displacementData: any = displacementArray?.getData?.();
  const numberOfComponents: number = displacementArray?.getNumberOfComponents?.() ?? 0;
  if (!displacementData || numberOfComponents !== 3) return;

  const points = polyData.getPoints();
  const pointsData: any = points?.getData?.();
  if (!pointsData || pointsData.length !== displacementData.length) return;

  const maxDispMag = computeMaxVectorMagnitude(displacementData);
  const boundsDiag = computeBoundsDiagonal(polyData.getBounds?.() || [0, 0, 0, 0, 0, 0]);
  if (!Number.isFinite(maxDispMag) || maxDispMag <= 0) {
    console.log('[Deform] Displacement vector found, but max magnitude is 0');
    return;
  }

  deformationMaxDispMag.value = maxDispMag;
  deformationBoundsDiag.value = boundsDiag;

  deformationState = {
    polyData,
    basePoints: new Float32Array(pointsData),
    displacement: new Float32Array(displacementData),
    maxDispMag,
    boundsDiag,
  };
  hasDisplacementVector.value = true;

  // Auto choose a visible default scale on load (similar intent to frd-viewer)
  const suggested = autoSuggestDeformationScale({ maxDispMag, boundsDiag });
  // Expand slider range by targeting a maximum visible deformation percent.
  // scaleMax(%) = (percent/100) * diag / max|u|
  const scaleAtMaxPercent = (deformationPercentMax.value / 100) * boundsDiag / maxDispMag;
  // Use a capped max to avoid absurdly large UI ranges.
  deformationScaleMax.value = Math.min(200000, Math.max(200, Math.ceil(scaleAtMaxPercent)));
  if (Number.isFinite(suggested) && suggested > 0) {
    // Avoid overly exaggerated default deformation; user can still drag higher.
    deformationScale.value = Math.min(suggested, 200);
  }

  console.log(
    `[Deform] ready: max|u|=${maxDispMag}, diag=${boundsDiag}, suggested=${suggested}, sliderMax=${deformationScaleMax.value}, scale=${deformationScale.value}, maxPercent=${deformationPercentMax.value}`
  );
}

function applyDeformationScale(scale: number) {
  if (!deformationState?.polyData || !renderWindow) return;

  const { polyData, basePoints, displacement } = deformationState;
  if (basePoints.length !== displacement.length) return;

  if (!Number.isFinite(scale)) return;

  const out = new Float32Array(basePoints.length);
  for (let i = 0; i < basePoints.length; i++) {
    out[i] = basePoints[i] + scale * displacement[i];
  }

  const points = polyData.getPoints();
  points.setData(out, 3);
  points.modified();
  polyData.modified();
  renderWindow.render();
}

function computeBoundsDiagonal(bounds: number[]) {
  const dx = (bounds?.[1] ?? 0) - (bounds?.[0] ?? 0);
  const dy = (bounds?.[3] ?? 0) - (bounds?.[2] ?? 0);
  const dz = (bounds?.[5] ?? 0) - (bounds?.[4] ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function computeMaxVectorMagnitude(vec: ArrayLike<number>) {
  let maxMag = 0;
  for (let i = 0; i + 2 < vec.length; i += 3) {
    const x = Number(vec[i]) || 0;
    const y = Number(vec[i + 1]) || 0;
    const z = Number(vec[i + 2]) || 0;
    const mag = Math.sqrt(x * x + y * y + z * z);
    if (mag > maxMag) maxMag = mag;
  }
  return maxMag;
}

function autoSuggestDeformationScale(params: { maxDispMag: number; boundsDiag: number }) {
  const { maxDispMag, boundsDiag } = params;
  // Target: make max displacement roughly 1% of model diagonal (less exaggerated by default)
  const target = boundsDiag > 0 ? 0.01 * boundsDiag : 1;
  const raw = target / maxDispMag;
  const clamped = Math.max(0, raw);
  // keep a reasonable precision so slider label is stable
  return Math.round(clamped * 100) / 100;
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

// 处理画布点击事件用于面选择
function handleCanvasClick(event: MouseEvent) {
  if (!store.isSelectingFace || !vtkContainer.value) {
    console.log('[Click] Not in selection mode or no container');
    return;
  }
  
  console.log('[Click] Canvas clicked in selection mode');
  
  // 获取点击相对于容器的坐标
  const rect = vtkContainer.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  console.log(`[Click] Coordinates: x=${x}, y=${y}`);
  
  // 执行拾取操作
  const pickedCell = performPick(x, y);
  
  if (pickedCell) {
    // 从选中的面提取面的ID或标识
    const faceId = pickedCell.cellId;
    console.log('[Click] 选中面 ID:', faceId);
    
    // 这里可以根据实际的网格数据结构来获取对应的物理组名称
    // 简单方案：假设选中了某个面，就标记它
    store.selectedFace = `Face_${faceId}`;
    store.selectedFaceData = pickedCell;
    
    // 高亮显示选中的面
    highlightSelectedFace(pickedCell);
    console.log('[Click] 高亮完成');
  } else {
    console.log('[Click] 未选中任何面');
  }
}

// 执行 VTK 拾取操作
function performPick(x: number, y: number): any {
  console.log('[Pick] Checking picker setup:', { 
    picker: !!picker, 
    renderWindow: !!renderWindow, 
    renderer: !!renderer, 
    currentActor: !!currentActor 
  });
  
  if (!picker || !renderWindow || !renderer || !currentActor) {
    console.log('[Pick] Setup incomplete, returning null');
    return null;
  }
  
  picker.pick([x, y, 0], renderer);
  
  const pickedActor = picker.getActor();
  const cellId = picker.getCellId();
  console.log('[Pick] Result:', { pickedActor: !!pickedActor, cellId, matches: pickedActor === currentActor });
  
  if (!pickedActor || pickedActor !== currentActor) {
    console.log('[Pick] No actor picked or actor mismatch');
    return null;
  }
  
  return {
    cellId: cellId,
    pickPos: picker.getPickPosition(),
    actor: pickedActor
  };
}

// 高亮显示选中的面 - 根据拾取的cell点集反查对应面
function highlightSelectedFace(pickedCell: any) {
  if (!currentActor || !currentPolyData) return;
  
  // 动态读取最新的 groupsData
  const currentGroupsData = store.groupsData;
  if (!currentGroupsData) {
    console.log('[Highlight] groupsData 尚未加载');
    return;
  }
  
  const cellId = pickedCell.cellId;
  console.log(`[Highlight] 鼠标点击高亮 - cellId: ${cellId}`);
  
  // 获取选中单元的所有点
  const polys = currentPolyData.getPolys();
  const conn = polys.getData();
  let idx = 0;
  let pickedPoints: number[] = [];
  
  for (let cid = 0; cid <= cellId; cid++) {
    const n = conn[idx++];
    if (cid === cellId) {
      for (let k = 0; k < n; k++) {
        pickedPoints.push(conn[idx++]);
      }
      break;
    } else {
      idx += n;
    }
  }
  
  // 查找包含这些点的面
  let matchedFaceName: string | null = null;
  const pickedSet = new Set(pickedPoints);
  
  for (const [faceName, nodeList] of Object.entries(currentGroupsData)) {
    const faceNodes = (nodeList as number[]).map(n => n - 1); // gmsh节点从1开始
    const faceSet = new Set(faceNodes);
    
    // 检查是否所有拾取的点都在这个面的节点集中
    let allMatch = true;
    for (const pid of pickedSet) {
      if (!faceSet.has(pid)) {
        allMatch = false;
        break;
      }
    }
    
    if (allMatch) {
      matchedFaceName = faceName;
      console.log(`[Highlight] 拾取单元匹配到面: ${faceName}`);
      break;
    }
  }
  
  // 如果找到了面，用单元掩码高亮
  if (matchedFaceName) {
    store.selectedFace = matchedFaceName;
    highlightFaceByName(matchedFaceName);
  } else {
    console.log('[Highlight] 未找到对应的面定义');
  }
}

// 取消面选择
function cancelFaceSelection() {
  store.isSelectingFace = false;
  store.selectedFace = null;
  store.selectedFaceData = null;
  
  // 恢复原始显示
  // 清除任何高亮遮罩
  highlightFaceByName('');
  if (currentActor && store.viewMode === 'mesh') {
    applyGreyMaterial(currentActor);
  }
  if (renderWindow) renderWindow.render();
}

// 根据面名称高亮（用于下拉列表选择）
function highlightFaceByName(faceName: string) {
  console.log(`[Highlight] highlightFaceByName called: ${faceName}, viewMode=${store.viewMode}`);
  
  const mapper = currentActor?.getMapper?.();
  if (!currentActor || !currentPolyData || !mapper) {
    console.log('[Highlight] 缺少必要对象，返回');
    return;
  }

  // 动态从 store 读取最新的 groupsData
  const currentGroupsData = store.groupsData;
  
  if (!faceName || !currentGroupsData || !currentGroupsData[faceName]) {
    console.log('[Highlight] 清空高亮或无数据');
    // 清空高亮：关闭标量可见，恢复灰色材质
    mapper.setScalarVisibility(false);
    applyGreyMaterial(currentActor);
    if (renderWindow) renderWindow.render();
    return;
  }

  try {
    const nodeList: number[] = currentGroupsData[faceName] || [];
    if (nodeList.length === 0) {
      console.log(`[Highlight] 未找到面 ${faceName} 的节点数据`);
      mapper.setScalarVisibility(false);
      applyGreyMaterial(currentActor);
      if (renderWindow) renderWindow.render();
      return;
    }

    const totalPoints = currentPolyData.getNumberOfPoints();
    const totalCells = currentPolyData.getNumberOfPolys();
    console.log(`[Highlight] 高亮面(按单元): ${faceName}`);
    console.log(`[Highlight] 该面节点数: ${nodeList.length}, 模型总点数: ${totalPoints} (占比: ${(nodeList.length/totalPoints*100).toFixed(1)}%)`);
    console.log(`[Highlight] 模型总单元数: ${totalCells}`);

    // 将节点列表转换为点ID集合（0基）
    const pointSet = new Set<number>();
    for (const nid of nodeList) {
      const pid = nid - 1;
      if (pid >= 0) pointSet.add(pid);
    }

    // 构建按cell的掩码，确保不越界渲染
    const numCells = currentPolyData.getNumberOfPolys();
    const mask = new Float32Array(numCells); // 默认0
    const polys = currentPolyData.getPolys();
    const conn = polys.getData();
    let idx = 0;
    let highlightedCount = 0;
    for (let cid = 0; cid < numCells; cid++) {
      const n = conn[idx++];
      let allIn = true;
      for (let k = 0; k < n; k++) {
        const pid = conn[idx++];
        if (!pointSet.has(pid)) allIn = false;
      }
      if (allIn) {
        mask[cid] = 1.0;
        highlightedCount++;
      }
    }
    
    console.log(`[Highlight] 被标记为高亮的单元数: ${highlightedCount}/${numCells} (${(highlightedCount/numCells*100).toFixed(1)}%)`);

    const newCellScalars = vtkDataArray.newInstance({
      numberOfComponents: 1,
      values: mask,
      name: 'highlight_cell_mask'
    });

    currentPolyData.getCellData().setScalars(newCellScalars);

    const lut = ensureHighlightLut();
    mapper.setLookupTable(lut);
    if (mapper.setScalarRange) mapper.setScalarRange(0.0, 1.0);
    if (mapper.setUseLookupTableScalarRange) mapper.setUseLookupTableScalarRange(false);
    if (mapper.setColorModeToMapScalars) mapper.setColorModeToMapScalars();
    if (mapper.setScalarModeToUseCellData) mapper.setScalarModeToUseCellData();
    mapper.setScalarVisibility(true);

    // 使用平面着色，边界不插值
    if (currentActor?.getProperty?.().setInterpolationToFlat) {
      currentActor.getProperty().setInterpolationToFlat();
    }
    applyEdgeVisibilityToActor(currentActor);
    if (renderWindow) renderWindow.render();
  } catch (e) {
    console.log('[Highlight] 错误:', e);
  }
}

// 监听全局事件用于高亮指定面
function setupFaceHighlightListener() {
  console.log('[Listener] 设置 highlight-face 事件监听器');
  window.addEventListener('highlight-face', ((e: any) => {
    const faceName = e.detail?.faceName || '';
    console.log('[Listener] 收到 highlight-face 事件，faceName:', faceName);
    highlightFaceByName(faceName);
  }) as EventListener);
}


</script>

<style scoped>
.vtk-container { width: 100%; height: 100%; position: absolute; background: #000; cursor: crosshair; }
.overlay-msg { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); color: white; background: rgba(0,0,0,0.7); padding: 20px; border-radius: 8px; z-index: 10; }
.spinner { border: 4px solid rgba(255,255,255,0.3); border-top: 4px solid white; border-radius: 50%; width: 30px; height: 30px; margin: 0 auto 10px; animation: spin 1s linear infinite; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.selection-hint {
  position: absolute; top: 20px; right: 20px;
  background: rgba(255, 193, 7, 0.95); padding: 12px 16px;
  border-radius: 8px; color: #333; font-weight: bold; font-size: 14px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 15;
  display: flex; gap: 10px; align-items: center;
}
.selection-hint button {
  padding: 4px 10px; background: #d32f2f; color: white; border: none;
  border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 12px;
}
.selection-hint button:hover {
  background: #c62828;
}

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