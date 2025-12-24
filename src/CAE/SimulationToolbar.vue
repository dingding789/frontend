<template>
  <div class="h-12 bg-gray-900/95 backdrop-blur flex items-center px-4 shadow-md z-50 shrink-0">
    
    <input 
      type="file" 
      ref="fileInput" 
      style="display: none" 
      accept=".step,.stp,.iges,.igs,.stl,.brep"
      @change="handleFileChange"
    />

    <button
      class="px-3 py-1 rounded mr-3 bg-gray-700 text-white hover:bg-gray-600"
      @click="onBack"
    >返回</button>

    <div class="flex-1"></div>
    
    <button class="px-3 py-1 rounded mr-2 bg-emerald-600 text-white hover:bg-emerald-500" @click="triggerUpload">
      导入模型
    </button>
    
    <button class="px-3 py-1 rounded mr-2 bg-blue-600 text-white hover:bg-blue-500" @click="store.generateMesh()">
      划分网格
    </button>
    
    <button class="px-3 py-1 rounded mr-2 bg-purple-600 text-white hover:bg-purple-500" @click="showBcDialog = true">
      设置边界条件
    </button>

    <button class="px-3 py-1 rounded mr-2 bg-orange-600 text-white hover:bg-orange-500" @click="store.buildSimulation()">
      构建仿真 (Build)
    </button>

    <button class="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-500" @click="store.solveSimulation()">
      求解 (Run)
    </button>
  </div>

  <BcDialog v-if="showBcDialog" @close="showBcDialog = false" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useCaeStore } from './useCaeStore';
import BcDialog from './BcDialog.vue'; // 引入弹窗组件

// 定义事件，用于通知父组件关闭
const emitEvents = defineEmits(['close-request']);

const fileInput = ref<HTMLInputElement | null>(null);
const store = useCaeStore();
const showBcDialog = ref(false); // 控制弹窗显示

// 返回
function onBack() {
  emitEvents('close-request');
}

// 触发上传
function triggerUpload() {
  fileInput.value?.click();
}

// 处理文件选择
function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    store.uploadModel(target.files[0]);
    target.value = ''; // 清空
  }
}
</script>