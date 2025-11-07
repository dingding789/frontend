<template>
  <!-- 悬浮对话框：仅点击“取消”才关闭，可拖动 -->
  <div
    class="fixed z-50 bg-gray-800 text-white rounded shadow-lg border border-gray-700"
    :style="{ top: `${pos.y}px`, left: `${pos.x}px`, cursor: dragging ? 'move' : 'default' }"
    @mousedown.self="startDrag"
  >
    <div
      class="px-4 py-2 border-b border-gray-700 font-medium select-none cursor-move"
      @mousedown.stop="startDrag"
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

const props = defineProps<{
  app?: any
  manager?: any
}>();

const emit = defineEmits<{
  (e: 'close'): void
}>();

const selectedMode = ref<'two-point' | 'three-point' | null>(null);

// 拖动相关
const pos = ref({ x: 16, y: 64 }); // 初始位置
const dragging = ref(false);
let dragOffset = { x: 0, y: 0 };

function startDrag(e: MouseEvent) {
  dragging.value = true;
  dragOffset = {
    x: e.clientX - pos.value.x,
    y: e.clientY - pos.value.y,
  };
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);
}
function onDrag(e: MouseEvent) {
  if (!dragging.value) return;
  pos.value.x = e.clientX - dragOffset.x;
  pos.value.y = e.clientY - dragOffset.y;
}
function stopDrag() {
  dragging.value = false;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', stopDrag);
}
onBeforeUnmount(stopDrag);

function setSelected(mode: 'two-point' | 'three-point') {
  selectedMode.value = mode;

  // 切到圆工具并设置模式（兼容多实现）
  try { props.manager?.sketchSession?.setTool('circle'); } catch {}
  try { props.manager?.setTool?.('circle'); } catch {}

  try { (props.manager as any)?.setCircleMode?.(mode); } catch {}
  try { (props.manager?.sketchSession as any)?.setCircleMode?.(mode); } catch {}
  try { (props.manager?.sketchSession as any).circleMode = mode; } catch {}
  try { (props.manager as any).circleMode = mode; } catch {}

  // 标记处于绘制状态（可选）
  try { (props.manager as any).isDrawing = true; } catch {}
  try { (props.manager as any).currentTool = 'circle'; } catch {}

  // 请求一次渲染（可选）
  try { props.app?.renderOnce?.(); } catch {}
}

function onCancel() {
  // 停止圆形绘制逻辑并切回选择
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
