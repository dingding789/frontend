<template>
  <div class="h-12 bg-gray-900 flex items-center px-4 shadow-md space-x-2">
    <template v-if="!sketch.sketchSession.isSketching.value">
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handleStartSketchClick">新建草图</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handleExtrudeClick">拉伸</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="closeSketchDialogs(undefined, 'revolve')">旋转</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="closeSketchDialogs(undefined, 'sweep')">扫掠</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="closeSketchDialogs(undefined, 'loft')">放样</button>
    </template>

    <template v-else>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handleFinishSketchClick">完成草图</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handlePointClick">点</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handleLineClick">直线</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handleRectClick">矩形</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handleCircleClick">圆</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handleArcClick">圆弧</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handleSplineClick">样条曲线</button>
    </template>

    <div class="flex-1"></div>

  </div>

  <!-- 固定在界面右上角的仿真按钮 -->
  <button
    class="fixed top-2 right-2 z-30 px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 shadow"
    @click="handleSimulateClick"
  >仿真</button>

  <RectModeDialog
    v-if="showRectDialog"
    :app="app"
    :manager="sketch"
    @close="showRectDialog = false"
  />

  <!-- 圆形对话框（悬浮） -->
  <CircleDialog
    v-if="showCircleDialog"
    :app="app"
    :manager="sketch"
    @close="showCircleDialog = false"
  />

  <!-- 圆弧对话框（悬浮） -->
  <ArcDialog
    v-if="showArcDialog"
    :app="app"
    :manager="sketch"
    @close="showArcDialog = false"
  />

  <!-- 样条对话框（悬浮） -->
  <SplineCurveDialog
    v-model:open="showSplineCurveDialog"
    :app="app"
    :manager="sketch"
    @select="handleSplineModeSelect"
  />

  <ExtrudeDialog
    v-if="extrude.dialogVisible"
    :extrudeMgr="app.extrudeMgr"
    :selectedSketch="extrude.selectedSketch"
  />
</template>

<script setup lang="ts">
import { onMounted, ref, reactive } from 'vue';
import AppManager from '../../core/AppManager';
import RectModeDialog from '../dialogs/RectModeDialog.vue';
import CircleDialog from '../dialogs/CircleDialog.vue';
import ExtrudeDialog from '../dialogs/ExtrudeDialog.vue';
import { CommandBarFns } from './CommandBarFns';
import * as THREE from 'three';
import type { ExtrudeItem } from '../../core/geometry/features/ExtrudeItem';
import ArcDialog from '../dialogs/ArcDialog.vue';
import SplineCurveDialog from '../dialogs/SplineCurveDialog.vue';
import { SketchEditManager } from '../../core/managers/sketchManager/SketchEditManager';

const app = AppManager.getInstance();
const sketch = app.sketchMgr;
const extrude = reactive(app.extrudeMgr); // 让其他简单属性也可响应（可选）

// 初始化编辑管理器（复用于回滚编辑会话）
const sketchEditManager: SketchEditManager =
  (sketch as any).sketchEditManager || new SketchEditManager(app, sketch);
(sketch as any).sketchEditManager = sketchEditManager;

const showRectDialog = ref(false);
const showCircleDialog = ref(false);
const showArcDialog = ref(false);
const showSplineCurveDialog = ref(false);

// 新增：记录当前是否为“编辑已有草图”模式（即双击进入）
const editingSketchId = ref<number | string | null>(null);

// 统一关闭：圆、圆弧、样条对话框（除 except 指定的外），并广播事件给对话框自处理
function closeSketchDialogs(except?: 'circle' | 'arc' | 'spline', tool?: string) {
  if (except !== 'circle') showCircleDialog.value = false;
  if (except !== 'arc') showArcDialog.value = false;
  if (except !== 'spline') showSplineCurveDialog.value = false;

  // 广播事件（Arc/Circle/Spline 对话框内已监听，可自关闭）
  try { window.dispatchEvent(new Event('sketch:close-dialogs')); } catch {}
  if (tool) {
    try { window.dispatchEvent(new CustomEvent('tool:changed', { detail: { tool } })); } catch {}
  }
}

function handleStartSketchClick() {
  closeSketchDialogs(undefined, 'startSketch');
  sketch.startSketch();
}
//可能没有用了
// 供外部调用（如 List.vue）——双击草图时调用此方法
// function handleSketchDblClick(id: number | string) {
//   closeSketchDialogs(undefined, 'startSketch');
//   editingSketchId.value = id;

//   const select = sketchEditManager.startEditSession(id);
//   if (!select) {
//     console.warn('未能进入草图编辑会话,id=', id);
//     return;
//   }
//   try {
//     (sketch.sketchSession as any).editingSketchId = id;
//     (sketch as any).editingSketchId = id;
//   } catch {}
//   try { app.renderOnce?.(); } catch {}
// }

// 完成草图：统一调用 finishSketch，它会自动判断是编辑还是新建
async function handleFinishSketchClick() {
  closeSketchDialogs(undefined, 'select');
  await sketch.finishSketch(true); // 改为调用 finishSketch，而不是直接调用编辑管理器
}

function handlePointClick() {
  closeSketchDialogs(undefined, 'point');
  sketch.sketchSession.setTool('point');
}
function handleLineClick() {
  closeSketchDialogs(undefined, 'line');
  sketch.sketchSession.setTool('line');
}

function handleRectClick() {
  closeSketchDialogs(undefined, 'rect');
  CommandBarFns.onRectClick(sketch, showRectDialog);
  // 强制保持对话框开启，防止外部逻辑把它置为 false
  showRectDialog.value = true;
}

// 仅切换矩形模式，不关闭对话框（保持位置不变）
function handleRectModeSelect(mode: 'two-point' | 'three-point') {
  // 留空：RectModeDialog 内部处理逻辑
}

function handleCircleClick() {
  // 打开“圆”对话框，先关闭其他两个
  closeSketchDialogs('circle', 'circle');
  showCircleDialog.value = true;
}
function handleArcClick() {
  // 打开“圆弧”对话框，先关闭其他两个
  closeSketchDialogs('arc', 'arc');
  showArcDialog.value = true;
}
// 样条对话框
function handleSplineClick() {
  closeSketchDialogs('spline', 'spline');
  // 若 SplineCurveDialog 内部自行设置工具，这里可以不设；保留设置以兼容现有行为
  try { sketch.sketchSession.setTool('spline'); } catch {}
  showSplineCurveDialog.value = true;
}
function handleSplineModeSelect(mode: 'passPoint' | 'dependencePoint') {
  // 留空：SplineCurveDialog 内部处理鼠标/绘制逻辑
}

function handleExtrudeClick() {
  closeSketchDialogs(undefined, 'extrude');
  extrude.dialogVisible = true;
  extrude.enablePickMode();
}

// 仿真按钮点击：广播事件，供页面其它模块监听处理
function handleSimulateClick() {
  closeSketchDialogs(undefined, 'simulate');
  try { window.dispatchEvent(new CustomEvent('simulation:open')); } catch {}
}

//(window as any).handleSketchDblClick = handleSketchDblClick;

onMounted(() => {
  app.animate(() => {
    // 每帧逻辑（可选）
  });
});
</script>