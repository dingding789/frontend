<template>
  <div class="h-12 bg-gray-900/95 backdrop-blur flex items-center px-4 shadow-md z-50 shrink-0">
    <input type="file" ref="fileInput" style="display: none" accept=".step,.stp,.iges,.igs,.stl" @change="handleFileChange"/>
    
    <button class="px-3 py-1 rounded mr-3 bg-gray-700 text-white hover:bg-gray-600" @click="onBack">返回</button>
    <div class="flex-1"></div>
    
    <button class="px-3 py-1 rounded mr-2 bg-emerald-600 text-white hover:bg-emerald-500" @click="triggerUpload">导入模型</button>
    
    <button class="px-3 py-1 rounded mr-2 bg-blue-600 text-white hover:bg-blue-500" @click="store.generateMesh()">
      划分网格
    </button>
    
    <button class="px-3 py-1 rounded mr-2 bg-emerald-600 text-white hover:bg-emerald-500" @click="emit('cae:set-bc')">设置边界条件</button>
    <button class="px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-500" @click="emit('cae:solve')">求解</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useCaeStore } from './useCaeStore';

const emitEvents = defineEmits(['close-request']);
const fileInput = ref<HTMLInputElement | null>(null);
const store = useCaeStore();

function onBack() { emitEvents('close-request'); }
function triggerUpload() { fileInput.value?.click(); }
function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    store.uploadModel(target.files[0]);
    target.value = '';
  }
}
function emit(eventName: string) { window.dispatchEvent(new CustomEvent(eventName)); }
</script>