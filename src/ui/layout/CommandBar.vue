<template>
  <div class="h-12 bg-gray-900 flex items-center px-4 shadow-md space-x-2">
    <template v-if="!sketch.sketchSession.isSketching.value">
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="sketch.startSketch()">新建草图</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handleExtrudeClick">拉伸</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded">旋转</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded">扫掠</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded">放样</button>
    </template>
    <!-- 如果在绘制草图模式下，显示完成草图及草图绘制工具按钮 -->
    <template v-else>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="sketch.finishSketch()">完成草图</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="sketch.sketchSession.setTool('point')">点</button>

      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="sketch.sketchSession.setTool('line')">直线</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="sketch.sketchSession.setTool('arc')">圆弧</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handleRectClick">矩形</button>
      <button class="px-3 py-1 hover:bg-gray-700 rounded" @click="handleCircleClick">圆</button>
    </template>
    <div class="flex-1"></div>
  </div>
  <!-- 矩形方式对话框 -->
  <RectModeDialog v-if="showRectDialog" @select="handleRectModeSelect" @close="showRectDialog = false" />
  <!-- 圆方式对话框 -->
  <CircleDLG v-if="showCircleDialog" @select="handleCircleModeSelect" @close="showCircleDialog = false" />
  <!-- 拉伸方式对话框 -->
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
import CircleDLG from '../dialogs/CircleDialog.vue';
import ExtrudeDialog from '../dialogs/ExtrudeDialog.vue';
import { CommandBarFns } from './CommandBarFns';
import * as THREE from 'three';
import type { ExtrudeItem } from '../../core/geometry/features/ExtrudeItem';

const app = AppManager.getInstance();
const sketch = app.sketchMgr;
const extrude = app.extrudeMgr;

const showRectDialog = ref(false);
const showCircleDialog = ref(false);
const showExtrudeDialog = ref(false);
const selectedSketch = ref<ExtrudeItem | null>(null);
const previewMesh = ref<THREE.Mesh | null>(null);
const customLineDir = ref<{ x: number, y: number, z: number } | null>(null);

function handleRectClick() {
  CommandBarFns.onRectClick(sketch, showRectDialog);
}
function handleCircleClick() {
  CommandBarFns.onCircleClick(sketch, showCircleDialog);
}
function handleRectModeSelect(mode) {
  CommandBarFns.onRectModeSelect(sketch, showRectDialog, mode);
}
function handleCircleModeSelect(mode) {
  CommandBarFns.onCircleModeSelect(sketch, showCircleDialog, mode);
}
function handleExtrudeClick() {
  CommandBarFns.onExtrudeClick(extrude, showExtrudeDialog, selectedSketch, CommandBarFns.sketchItemToExtrudeItem);
}
function handleExtrudeConfirm(params) {
  CommandBarFns.onExtrudeConfirm(app, extrude, selectedSketch, previewMesh, showExtrudeDialog, params);
}
function handleExtrudeClose() {
  CommandBarFns.onExtrudeClose(app, previewMesh, showExtrudeDialog);
}

// 可选：在 mounted 时添加其他初始化逻辑，比如动画
onMounted(() => {

  //sketch.loadAll();
  app.animate(() => {
    // 这里可以做草图高亮或其他每帧逻辑
  });
});

</script>