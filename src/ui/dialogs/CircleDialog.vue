<template>
  <div class="fixed top-16 left-4 z-50 bg-gray-800 text-white rounded shadow-lg border border-gray-700">
    <div class="px-4 py-2 border-b border-gray-700 font-medium">圆形方式</div>
    <div class="p-3 space-y-2">
      <button class="w-full px-3 py-1 rounded bg-gray-700 hover:bg-gray-600" @click="$emit('select','two-point')">两点圆</button>
      <button class="w-full px-3 py-1 rounded bg-gray-700 hover:bg-gray-600" @click="$emit('select','three-point')">三点圆</button>
      <div class="text-right pt-1">
        <button class="px-2 py-1 text-sm text-gray-300 hover:text-white" @click="$emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 纯展示/选择对话框，由父组件控制显示与处理
// 事件：select('two-point'|'three-point'), close

defineEmits<{
  (e: 'select', mode: 'two-point' | 'three-point'): void
  (e: 'close'): void
}>()
</script>

<style scoped>
</style>
