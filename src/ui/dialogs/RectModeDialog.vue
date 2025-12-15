<template>
  <div
    ref="dialogRef"
    class="fixed z-50 bg-gray-800 text-white rounded shadow-lg border border-gray-700"
  >
    <div
      class="px-4 py-2 border-b border-gray-700 font-medium select-none cursor-move"
      @mousedown.stop="onDialogHeaderMouseDown"
    >
      矩形方式
    </div>
    <div class="p-3 space-y-2">
      <button
        :class="buttonClass('two-point')"
        :aria-pressed="selectedMode === 'two-point'"
        @click="setSelected('two-point')"
      >两点矩形</button>
      <button
        :class="buttonClass('three-point')"
        :aria-pressed="selectedMode === 'three-point'"
        @click="setSelected('three-point')"
      >三点（中心线）</button>
      <div class="text-right pt-1">
        <button class="px-2 py-1 text-sm text-gray-300 hover:text-white" @click="onCancel">关闭</button>
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
  (e: 'select', mode: 'two-point' | 'three-point'): void
  (e: 'close'): void
}>();

const selectedMode = ref<'two-point' | 'three-point'>('two-point');
const dialogRef = ref<HTMLElement | null>(null);

// 初始位置（仅首次挂载设置，不在模式切换时重置）
const initialPos = { x: 16, y: 64 };
// 记忆拖动后位置，避免重新挂载回到初始
let lastRectDialogPos: { x: number; y: number } | null = null;

function applyInitialPosition() {
  if (!dialogRef.value) return;
  const p = lastRectDialogPos ?? initialPos;
  dialogRef.value.style.position = 'fixed';
  dialogRef.value.style.left = p.x + 'px';
  dialogRef.value.style.top = p.y + 'px';
}

function onDialogHeaderMouseDown(e: MouseEvent) {
  if (!dialogRef.value) return;
  DialogMouseEventManager.getInstance().registerDialogDrag(dialogRef.value, e);
  // 跟踪位置用于下次还原
  const onMove = () => {
    if (!dialogRef.value) return;
    const r = dialogRef.value.getBoundingClientRect();
    lastRectDialogPos = { x: Math.round(r.left), y: Math.round(r.top) };
  };
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (dialogRef.value) {
      const r = dialogRef.value.getBoundingClientRect();
      lastRectDialogPos = { x: Math.round(r.left), y: Math.round(r.top) };
    }
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}

function setSelected(mode: 'two-point' | 'three-point') {
  selectedMode.value = mode;
  // 与圆/圆弧/样条逻辑一致：设置工具 + 模式，不关闭、不改位置
  try { props.manager?.sketchSession?.setTool?.('rect'); } catch {}
  try { props.manager?.setTool?.('rect'); } catch {}
  try { (props.manager as any)?.setRectMode?.(mode); } catch {}
  try { (props.manager?.sketchSession as any)?.setRectMode?.(mode); } catch {}
  try { (props.manager as any).rectMode = mode; } catch {}
  try { (props.manager as any).isDrawing = true; } catch {}
  try { (props.manager as any).currentTool = 'rect'; } catch {}
  try { props.app?.renderOnce?.(); } catch {}
  // 通过全局事件（可选供其它模块监听）
  try { window.dispatchEvent(new CustomEvent('dialog:rect-mode-select', { detail: { mode } })); } catch {}
  emit('select', mode);
}

function onCancel() {
  emit('close');
}

function externalClose() {
  emit('close');
}

function onToolChanged(ev: Event) {
  const tool = (ev as CustomEvent).detail?.tool;
  if (tool && tool !== 'rect') externalClose();
}

function buttonClass(mode: 'two-point' | 'three-point') {
  const base = 'w-full px-3 py-1 rounded transition-colors';
  const selected = selectedMode.value === mode ? 'bg-cyan-700 hover:bg-cyan-600' : 'bg-gray-700 hover:bg-gray-600';
  return `${base} ${selected}`;
}

onMounted(() => {
  applyInitialPosition();
  // 监听与其它对话框一致的全局关闭事件
  window.addEventListener('sketch:close-dialogs', externalClose);
  window.addEventListener('tool:changed', onToolChanged as EventListener);
});

onBeforeUnmount(() => {
  window.removeEventListener('sketch:close-dialogs', externalClose);
  window.removeEventListener('tool:changed', onToolChanged as EventListener);
});
</script>

<style scoped>
</style>
