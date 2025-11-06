<template>
  <div class="h-12 bg-gray-900 flex items-center px-4 shadow-md space-x-2">
    <template v-if="!sketch.sketchSession.isSketching.value">
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="sketch.startSketch()">新建草图</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handleExtrudeClick">拉伸</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded">旋转</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded">扫掠</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded">放样</button>
    </template>

    <template v-else>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="sketch.finishSketch()">完成草图</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="sketch.sketchSession.setTool('point')">点</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="sketch.sketchSession.setTool('line')">直线</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handleRectClick">矩形</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handleCircleClick">圆</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handleArcClick">圆弧</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handleSplineClick">样条曲线</button>
    </template>

    <div class="flex-1"></div>
  </div>

  <!-- 对话框 -->
  <RectModeDialog v-if="showRectDialog" @select="handleRectModeSelect" @close="showRectDialog = false" />
  <CircleDialog v-if="showCircleDialog" @select="handleCircleModeSelect" @close="showCircleDialog = false" />
  <ArcDialog v-if="showArcDialog" @select="handleArcModeSelect" @close="showArcDialog = false" />

  <!-- 使用 v-model:open 绑定，确保对话框可打开/关闭 -->
  <SplineCurveDialog
    v-model:open="showSplineCurveDialog"
    :app="app"
    :manager="sketch"
    @select="handleSplineModeSelect"
  />

  <ExtrudeDialog
    v-if="showExtrudeDialog"
    :selectedSketch="selectedSketch"
    @preview="CommandBarFns.onExtrudePreview(app, extrude, selectedSketch, previewMesh, $event)"
    @confirm="handleExtrudeConfirm($event)"
    @close="handleExtrudeClose()"
  />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AppManager from '../../core/scene/SceneManager';
import RectModeDialog from '../dialogs/RectModeDialog.vue';
import CircleDialog from '../dialogs/CircleDialog.vue';
import ExtrudeDialog from '../dialogs/ExtrudeDialog.vue';
import { CommandBarFns } from './CommandBarFns';
import * as THREE from 'three';
import type { ExtrudeItem } from '../../core/geometry/features/ExtrudeItem';
import ArcDialog from '../dialogs/ArcDialog.vue';
import SplineCurveDialog from '../dialogs/SplineCurveDialog.vue';

const app = AppManager.getInstance();
const sketch = app.sketchMgr;
const extrude = app.extrudeMgr;

const showRectDialog = ref(false);
const showCircleDialog = ref(false);
const showExtrudeDialog = ref(false);
const showArcDialog = ref(false);
const showSplineCurveDialog = ref(false);

const selectedSketch = ref<ExtrudeItem | null>(null);
const previewMesh = ref<THREE.Mesh | null>(null);
const customLineDir = ref<{ x: number, y: number, z: number } | null>(null);

function handleRectClick() {
  CommandBarFns.onRectClick(sketch, showRectDialog);
}
function handleCircleClick() {
  CommandBarFns.onCircleClick(sketch, showCircleDialog);
}
function handleRectModeSelect(mode: any) {
  CommandBarFns.onRectModeSelect(sketch, showRectDialog, mode);
}
function handleCircleModeSelect(mode: any) {
  CommandBarFns.onCircleModeSelect(sketch, showCircleDialog, mode);
}
function handleExtrudeClick() {
  CommandBarFns.onExtrudeClick(extrude, showExtrudeDialog, selectedSketch, CommandBarFns.sketchItemToExtrudeItem);
}
function handleExtrudeConfirm(params: any) {
  CommandBarFns.onExtrudeConfirm(app, extrude, selectedSketch, previewMesh, showExtrudeDialog, params);
}
function handleExtrudeClose() {
  CommandBarFns.onExtrudeClose(app, previewMesh, showExtrudeDialog);
}

function handleArcClick() {
  CommandBarFns.onArcClick(sketch, showArcDialog);
}
function handleArcModeSelect(mode: any) {
  CommandBarFns.onArcModeSelect(sketch, showArcDialog, mode);
}

// 点击样条按钮：切工具并打开对话框
function handleSplineClick() {
  sketch.sketchSession.setTool('spline');
  showSplineCurveDialog.value = true;
}

// 接收对话框选择（占位）
function handleSplineModeSelect(mode: 'passPoint' | 'dependencePoint') {
  // 如需同步到会话： sketch.sketchSession.setSplineMode?.(mode);
}

// mounted
onMounted(() => {
  app.animate(() => {
    // 每帧逻辑（可选）
  });
});
</script>