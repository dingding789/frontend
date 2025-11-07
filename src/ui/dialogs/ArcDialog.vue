<template>
  <div
    class="fixed z-50 bg-gray-800 text-white rounded shadow-lg border border-gray-700 w-64"
    :style="{ top: `${pos.y}px`, left: `${pos.x}px`, cursor: dragging ? 'move' : 'default' }"
    @mousedown.self="startDrag"
  >
    <div
      class="px-3 py-2 border-b border-gray-700 font-medium select-none cursor-move"
      @mousedown.stop="startDrag"
    >
      圆弧方式
    </div>
    <div class="p-2 space-y-2">
      <button
        :class="buttonClass('threePoints')"
        :aria-pressed="selectedMode === 'threePoints'"
        @click="setSelected('threePoints')"
      >
        三点圆弧
      </button>
      <button
        :class="buttonClass('centerStartEnd')"
        :aria-pressed="selectedMode === 'centerStartEnd'"
        @click="setSelected('centerStartEnd')"
      >
        中心圆弧
      </button>
      <div class="text-right pt-1">
        <button class="px-2 py-1 text-xs text-gray-300 hover:text-white" @click="onCancel">取消</button>
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

const emit = defineEmits<{ (e: 'close'): void }>();

const selectedMode = ref<'threePoints' | 'centerStartEnd' | null>(null);

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

function setSelected(mode: 'threePoints' | 'centerStartEnd') {
  selectedMode.value = mode;
  try { props.manager?.sketchSession?.setTool('arc'); } catch {}
  try { props.manager?.setTool?.('arc'); } catch {}
  try { (props.manager as any)?.setArcMode?.(mode); } catch {}
  try { (props.manager?.sketchSession as any)?.setArcMode?.(mode); } catch {}
  try { (props.manager?.sketchSession as any).arcMode = mode; } catch {}
  try { (props.manager as any).arcMode = mode; } catch {}
  try { (props.manager as any).isDrawing = true; } catch {}
  try { (props.manager as any).currentTool = 'arc'; } catch {}
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

function buttonClass(mode: 'threePoints' | 'centerStartEnd') {
  const base = 'w-full h-8 px-3 rounded text-sm transition-colors';
  const selected = selectedMode.value === mode ? 'bg-cyan-700 hover:bg-cyan-600' : 'bg-gray-700 hover:bg-gray-600';
  return `${base} ${selected}`;
}
</script>