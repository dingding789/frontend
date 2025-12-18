<template>
  <div class="cae-layout w-full h-full flex flex-col relative">
    <SimulationToolbar ref="toolbarRef" />
    
    <div class="flex-1 bg-gray-800 relative z-0">
      <CaeViewer />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import SimulationToolbar from './SimulationToolbar.vue';
import CaeViewer from './CaeViewer.vue';

const toolbarRef = ref<any>(null);

// 模拟打开工具栏（如果你是作为独立页面进入，可能需要手动触发显示）
onMounted(() => {
  // 延时一下确保组件加载，或者直接调用
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('simulation:open'));
  }, 100);
});
</script>

<style scoped>
.cae-layout {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
</style>