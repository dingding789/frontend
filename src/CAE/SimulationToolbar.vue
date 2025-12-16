<template>
  <div
    v-if="visible"
    class="fixed top-0 left-0 right-0 h-12 bg-gray-900/95 backdrop-blur flex items-center px-4 shadow-md z-40"
  >
    <!-- 返回按钮：点击返回初始界面 -->
    <button
      class="px-3 py-1 rounded mr-3 bg-gray-700 text-white hover:bg-gray-600"
      @click="onBack"
    >返回</button>

    <div class="flex-1"></div>
    <button class="px-3 py-1 rounded mr-2 bg-emerald-600 text-white hover:bg-emerald-500" @click="onImport">导入模型</button>
    <button class="px-3 py-1 rounded mr-2 bg-emerald-600 text-white hover:bg-emerald-500" @click="onMesh">划分网格</button>
    <button class="px-3 py-1 rounded mr-2 bg-emerald-600 text-white hover:bg-emerald-500" @click="onBC">设置边界条件</button>
    <button class="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-500" @click="onSolve">求解</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

const visible = ref(false);

function show() { visible.value = true; }
function hide() { visible.value = false; }

function onImport() {
  // 触发“导入模型”事件，供其他模块监听处理
  window.dispatchEvent(new CustomEvent('cae:import-model'));
}
function onMesh() {
  // 触发“划分网格”事件，供其他模块监听处理
  window.dispatchEvent(new CustomEvent('cae:mesh'));
}
function onBC() {
  // 触发“设置边界条件”事件，供其他模块监听处理
  window.dispatchEvent(new CustomEvent('cae:set-bc'));
}
function onSolve() {
  // 触发“求解”事件，供其他模块监听处理
  window.dispatchEvent(new CustomEvent('cae:solve'));
}

// 返回初始界面（关闭 CAE 工具栏）
function onBack() {
  window.dispatchEvent(new CustomEvent('simulation:close'));
}

function handleSimOpen() { show(); }
function handleSimClose() { hide(); }

onMounted(() => {
  // 监听仿真打开/关闭事件，控制工具栏显示与隐藏
  window.addEventListener('simulation:open', handleSimOpen);
  window.addEventListener('simulation:close', handleSimClose);

  // 监听键盘 ESC 键以返回初始界面
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      window.dispatchEvent(new CustomEvent('simulation:close'));
    }
  };
  window.addEventListener('keydown', onKeyDown);

  // 保存以便卸载时移除（通过闭包变量引用）
  (onBack as any)._onKeyDown = onKeyDown;
});

onBeforeUnmount(() => {
  // 组件卸载时移除事件监听
  window.removeEventListener('simulation:open', handleSimOpen);
  window.removeEventListener('simulation:close', handleSimClose);

  const onKeyDown = (onBack as any)._onKeyDown as (e: KeyboardEvent) => void;
  if (onKeyDown) {
    window.removeEventListener('keydown', onKeyDown);
  }
});
</script>
