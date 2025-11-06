<template>
  <div class="fixed top-16 left-4 z-50 bg-gray-800 text-white rounded shadow-lg border border-gray-700 w-64">
    <div class="px-3 py-2 border-b border-gray-700 font-medium">圆弧方式</div>
    <div class="p-2 space-y-2">
      <button class="w-full h-8 px-3 rounded bg-gray-700 hover:bg-gray-600 text-sm" @click="$emit('select','threePoints')">
        三点圆弧
      </button>
      <button class="w-full h-8 px-3 rounded bg-gray-700 hover:bg-gray-600 text-sm" @click="$emit('select','centerStartEnd')">
        中心圆弧
      </button>
      <div class="text-right pt-1">
        <button class="px-2 py-1 text-xs text-gray-300 hover:text-white" @click="$emit('close')">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  (e: 'select', mode: 'threePoints' | 'centerStartEnd'): void
  (e: 'close'): void
}>()
</script>