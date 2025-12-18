<template>
  <div v-if="visible" class="cae-fullscreen-layer">
    <SimulationToolbar @close-request="closeCae" />
    
    <div class="viewer-area">
      <CaeViewer />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import SimulationToolbar from './SimulationToolbar.vue';
import CaeViewer from './CaeViewer.vue';

const visible = ref(false);

function openCae() {
  visible.value = true;
}

function closeCae() {
  visible.value = false;
  // 广播关闭事件，但标记来源，避免本组件再次响应造成递归
  window.dispatchEvent(new CustomEvent('simulation:close', { detail: { source: 'CaeMain' } }));
}

function handleGlobalClose(e: Event) {
  const ce = e as CustomEvent;
  if (ce?.detail?.source === 'CaeMain') return; // 忽略自身广播
  visible.value = false;
}

onMounted(() => {
  window.addEventListener('simulation:open', openCae);
  window.addEventListener('simulation:close', handleGlobalClose);
});

onBeforeUnmount(() => {
  window.removeEventListener('simulation:open', openCae);
  window.removeEventListener('simulation:close', handleGlobalClose);
});
</script>

<style scoped>
.cae-fullscreen-layer {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999; /* 确保最上层 */
  background-color: #2c3e50;
  display: flex;
  flex-direction: column;
}

.viewer-area {
  flex: 1; /* 占据除工具栏外的剩余空间 */
  position: relative;
  overflow: hidden;
}
</style>