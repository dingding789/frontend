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
      <!-- 改为调用处理函数：先关闭其它对话框 -->
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

  <RectModeDialog
    v-if="showRectDialog"
    :app="app"
    :manager="sketch"
    @select="handleRectModeSelect"
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
function handleFinishSketchClick() {
  closeSketchDialogs(undefined, 'select');
  sketch.finishSketch();
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
  // 启用矩形工具（与直线等一致，确保捕获鼠标）
  try { sketch.sketchSession.setTool('rect'); } catch {}
  try { (sketch as any).setTool?.('rect'); } catch {}

  // 设置矩形模式并进入绘制
  try { (sketch as any)?.setRectMode?.(mode); } catch {}
  try { (sketch.sketchSession as any)?.setRectMode?.(mode); } catch {}
  try { (sketch as any).rectMode = mode; } catch {}
  try { (sketch as any).isDrawing = true; } catch {}
  try { (sketch as any).currentTool = 'rect'; } catch {}

  // 不关闭对话框，不重置位置
  try { app?.renderOnce?.(); } catch {}
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
  CommandBarFns.onExtrudeClick(extrude, showExtrudeDialog, selectedSketch, CommandBarFns.sketchItemToExtrudeItem);
}
function handleExtrudeConfirm(params: any) {
  CommandBarFns.onExtrudeConfirm(app, extrude, selectedSketch, previewMesh, showExtrudeDialog, params);
}
function handleExtrudeClose() {
  CommandBarFns.onExtrudeClose(app, previewMesh, showExtrudeDialog);
}


onMounted(() => {
  app.animate(() => {
    // 每帧逻辑（可选）
  });
});
</script>