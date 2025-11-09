<template>
  <!-- 悬浮对话框：仅点击“取消”才关闭，可拖动 -->
  <div
    ref="dialogRef"
    class="fixed z-50 bg-gray-800 text-white rounded shadow-lg border border-gray-700"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px`, position: 'fixed' }"
  >
    <div
      class="px-4 py-2 border-b border-gray-700 font-medium select-none cursor-move"
      @mousedown.stop="onDialogHeaderMouseDown"
    >
      圆形方式
    </div>
    <div class="p-3 space-y-2">
      <button
        :class="buttonClass('two-point')"
        :aria-pressed="selectedMode === 'two-point'"
        @click="setSelected('two-point')"
      >
        两点圆
      </button>
      <button
        :class="buttonClass('three-point')"
        :aria-pressed="selectedMode === 'three-point'"
        @click="setSelected('three-point')"
      >
        三点圆
      </button>
      <div class="text-right pt-1">
        <button class="px-2 py-1 text-sm text-gray-300 hover:text-white" @click="onCancel">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { DialogMouseEventManager } from '../../core/managers/eventManager/sketchsEvent/DialogBaseEvents';

const props = defineProps<{
  app?: any
  manager?: any
}>();

const emit = defineEmits<{
  (e: 'close'): void
}>();

const selectedMode = ref<'two-point' | 'three-point' | null>(null);

const pos = ref({ x: 16, y: 64 }); // 初始位置
const dialogRef = ref<HTMLElement | null>(null);

function onDialogHeaderMouseDown(e: MouseEvent) {
  if (!dialogRef.value) return;
  // 拖动时动态获取宽度，限制不会超出窗口
  const dialogWidth = dialogRef.value.offsetWidth || 256;
  const dialogHeight = dialogRef.value.offsetHeight || 180;
  const rect = dialogRef.value.getBoundingClientRect();
  const dragOffset = {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };

  function onMouseMove(ev: MouseEvent) {
    let x = ev.clientX - dragOffset.x;
    let y = ev.clientY - dragOffset.y;
    x = Math.max(0, Math.min(x, window.innerWidth - dialogWidth));
    y = Math.max(0, Math.min(y, window.innerHeight - dialogHeight));
    pos.value.x = x;
    pos.value.y = y;
  }
  function onMouseUp() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function setSelected(mode: 'two-point' | 'three-point') {
  selectedMode.value = mode;
  try { props.manager?.sketchSession?.setTool('circle'); } catch {}
  try { props.manager?.setTool?.('circle'); } catch {}
  try { (props.manager as any)?.setCircleMode?.(mode); } catch {}
  try { (props.manager?.sketchSession as any)?.setCircleMode?.(mode); } catch {}
  try { (props.manager?.sketchSession as any).circleMode = mode; } catch {}
  try { (props.manager as any).circleMode = mode; } catch {}
  try { (props.manager as any).isDrawing = true; } catch {}
  try { (props.manager as any).currentTool = 'circle'; } catch {}
  try { props.app?.renderOnce?.(); } catch {}
}

function onCancel() {
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
  emit('close');
}

function buttonClass(mode: 'two-point' | 'three-point') {
  const base = 'w-full px-3 py-1 rounded transition-colors';
  const selected = selectedMode.value === mode ? 'bg-cyan-700 hover:bg-cyan-600' : 'bg-gray-700 hover:bg-gray-600';
  return `${base} ${selected}`;
}

// 全局关闭监听（与圆弧、样条一致）
function closeSelf() {
  emit('close');
}
function onExternalClose() {
  closeSelf();
}
function onToolChanged(e: Event) {
  const tool = (e as CustomEvent<any>)?.detail?.tool;
  if (tool && tool !== 'circle') {
    closeSelf();
  }
}
onMounted(() => {
  window.addEventListener('sketch:close-dialogs', onExternalClose);
  window.addEventListener('tool:changed', onToolChanged as EventListener);
});
onBeforeUnmount(() => {
  window.removeEventListener('sketch:close-dialogs', onExternalClose);
  window.removeEventListener('tool:changed', onToolChanged as EventListener);
});
</script>
