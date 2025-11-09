<template>
  <div
    v-if="isOpen"
    ref="dialogRef"
    class="fixed z-50 bg-gray-800 text-white rounded shadow-lg border border-gray-700 w-64"
    :style="{ top: `${pos.y}px`, left: `${pos.x}px` }"
  >
    <div
      class="px-4 py-2 border-b border-gray-700 font-medium select-none cursor-move"
      @mousedown.stop="onDialogHeaderMouseDown"
    >
      样条曲线
    </div>

    <div class="p-3">
      <div class="space-y-3">
        <div class="text-sm text-gray-300">绘制模式</div>
        <div class="space-y-2">
          <button
            class="w-full px-3 py-1 rounded text-left"
            :class="selectedMode === 'passPoint' ? 'bg-cyan-700 hover:bg-cyan-600' : 'bg-gray-700 hover:bg-gray-600'"
            @click="chooseMode('passPoint')"
          >
            通过点
          </button>
          <button
            class="w-full px-3 py-1 rounded text-left"
            :class="selectedMode === 'dependencePoint' ? 'bg-cyan-700 hover:bg-cyan-600' : 'bg-gray-700 hover:bg-gray-600'"
            @click="chooseMode('dependencePoint')"
          >
            根据极点
          </button>
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-3">
        <button class="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600" @click="onCancel">取消</button>
        <button class="px-3 py-1 rounded bg-cyan-700 hover:bg-cyan-600" @click="onFinish">完成</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref, onMounted, onBeforeUnmount } from 'vue';
import { SplineCurveItem } from '../../core/geometry/sketchs/SplineCurveItem';
import {DialogMouseEventManager} from '../../core/managers/eventManager/sketchsEvent/DialogBaseEvents';

type SplineModeUI = 'passPoint' | 'dependencePoint';

interface Props {
  open: boolean;
  app?: any;
  manager?: any;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'select', mode: SplineModeUI): void;
  (e: 'finish', mode: SplineModeUI): void;
  (e: 'cancel'): void;
  (e: 'close'): void;
}>();

// 拖动相关
const pos = ref({ x: 16, y: 64 }); // 初始位置
const dialogRef = ref<HTMLElement | null>(null);

function onDialogHeaderMouseDown(e: MouseEvent) {
  if (dialogRef.value) {
    DialogMouseEventManager.getInstance().registerDialogDrag(dialogRef.value, e);
  }
}

// v-model:open 绑定（对话框悬浮，除取消/完成或外部切换工具才关闭）
const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
});

// 默认模式：通过点
const selectedMode = ref<SplineModeUI>('passPoint');

// 打开时通知父组件当前选择（与 ArcDialog / CircleDialog 保持一致）
watch(() => props.open, (newVal) => {
  if (newVal) emit('select', selectedMode.value);
});

// 切换模式：只高亮并切换逻辑，不关闭对话框
function chooseMode(mode: SplineModeUI) {
  selectedMode.value = mode;
  emit('select', mode);
}

// 停止样条绘制/鼠标交互并切回选择工具（与圆/圆弧一致）
function stopSplineTool() {
  // 优先走类方法（若提供）
  try {
    if (props.app && props.manager && typeof SplineCurveItem.finishAndExitTool === 'function') {
      SplineCurveItem.finishAndExitTool(props.app, props.manager);
      return;
    }
  } catch {}

  // 回退清理：移除 previewItem，切回 select
  try {
    const mgr = props.manager as any;
    if (mgr?.previewItem) {
      const prev = mgr.previewItem;
      try {
        if (typeof prev.remove === 'function') prev.remove(props.app?.scene);
        else if (prev?.object3D && props.app?.scene) props.app.scene.remove(prev.object3D);
      } catch {}
      mgr.previewItem = null;
    }
    if (mgr?.sketchSession?.setTool) mgr.sketchSession.setTool('select');
    else if (mgr?.setTool) mgr.setTool('select');
    mgr.isDrawing = false;
    mgr.currentTool = 'select';
  } catch {}
  try { props.app?.renderOnce?.(); } catch {}
}

// 完成：结束并关闭
function onFinish() {
  try {
    if (props.app && props.manager && typeof SplineCurveItem.finishAndExitTool === 'function') {
      SplineCurveItem.finishAndExitTool(props.app, props.manager);
    } else {
      emit('finish', selectedMode.value);
    }
  } catch {}
  emit('close');
  isOpen.value = false;
}

// 取消：停止绘制并关闭
function onCancel() {
  stopSplineTool();
  emit('cancel');
  emit('close');
  isOpen.value = false;
}

// 监听外部事件：当点击其它按钮（切换工具）时自动关闭（与圆/圆弧一致）
function externalClose() {
  stopSplineTool();
  emit('close');
  isOpen.value = false;
}
function onToolChanged(e: Event) {
  const tool = (e as CustomEvent<any>)?.detail?.tool;
  if (tool && tool !== 'spline') {
    externalClose();
  }
}

onMounted(() => {
  window.addEventListener('sketch:close-dialogs', externalClose);
  window.addEventListener('tool:changed', onToolChanged as EventListener);
  if (dialogRef.value) {
    dialogRef.value.style.left = pos.value.x + 'px';
    dialogRef.value.style.top = pos.value.y + 'px';
    dialogRef.value.style.position = 'fixed';
  }
});
onBeforeUnmount(() => {
  window.removeEventListener('sketch:close-dialogs', externalClose);
  window.removeEventListener('tool:changed', onToolChanged as EventListener);
});
</script>

<style scoped>
/* 保持与其他对话框一致 */
</style>