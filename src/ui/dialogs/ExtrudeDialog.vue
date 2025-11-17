<template>
  <div
    v-if="extrudeMgr?.dialogVisible.value"
    class="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white rounded-xl shadow-2xl border border-gray-700 min-w-[400px] animate-fade-in overflow-hidden"
  >
    <!-- 标题区 -->
    <div class="flex items-center px-6 py-3 border-b border-gray-700">
      <svg class="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 01.88 7.903A4.5 4.5 0 1112 6.5V7"></path>
      </svg>
      <span class="font-bold text-lg tracking-wide select-none">拉伸</span>
    </div>

    <!-- 内容区 -->
    <div class="p-6 space-y-6">
      <!-- 1. 草图选择 -->
      <div>
        <div class="font-medium text-gray-300 mb-1">草图选择</div>
        <div class="flex items-center gap-2">
          <span v-if="extrudeMgr.selectedSketch" class="text-blue-300 font-mono text-sm flex-1">
            {{ sketchDisplay }}
          </span>
            <span v-else class="text-gray-400 italic text-sm flex-1">未选择</span>
          <button
            class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
            @click="onPickSketch"
          >
            选择草图
          </button>
        </div>
      </div>

      <!-- 2. 参数设置 -->
      <div>
        <div class="font-medium text-gray-300 mb-1">参数设置</div>
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <label class="w-20 text-gray-400">起点：</label>
            <input
              v-model.number="startValue"
              type="number"
              class="w-24 px-2 py-1 rounded bg-gray-700 border border-gray-600 text-white"
            />
            <label class="w-20 text-gray-400">终点：</label>
            <input
              v-model.number="endValue"
              type="number"
              class="w-24 px-2 py-1 rounded bg-gray-700 border border-gray-600 text-white"
            />
          </div>
        </div>
      </div>

      <!-- 按钮区 -->
      <div class="flex justify-end pt-2 gap-3">
        <button
          class="px-6 py-1.5 rounded bg-blue-600 hover:bg-blue-500 active:bg-blue-700 transition font-semibold shadow focus:outline-none focus:ring-2 focus:ring-blue-400"
          @click="onConfirm"
          :disabled="!extrudeMgr.selectedSketch"
        >
          确定
        </button>
        <button
          class="px-5 py-1.5 rounded bg-gray-600 hover:bg-gray-500 active:bg-gray-700 transition font-semibold shadow"
          @click="onCancel"
        >
          取消
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineProps } from 'vue';
import type { ExtrudeItem } from '../../core/geometry/features/ExtrudeItem';
import type { ExtrudeManager } from '../../core/managers/featureManager/ExtrudeManager';

// 父组件传入当前的 ExtrudeManager 实例与其 selectedSketch（可选冗余，主要使用 extrudeMgr）
const props = defineProps<{
  extrudeMgr: ExtrudeManager;
  selectedSketch?: ExtrudeItem | null;
}>();

// 与 ExtrudeManager 的 start/endValue 同步（初始化）
const startValue = ref(props.extrudeMgr.startValue ?? 0);
const endValue = ref(props.extrudeMgr.endValue ?? 10);

// 显示名称：使用 ExtrudeManager 的 selectedSketchName
const sketchDisplay = computed(() => props.extrudeMgr.selectedSketchName);



// 选择草图：调用 enablePickMode，一次性拾取
function onPickSketch() {
  props.extrudeMgr.enablePickMode();
}

// 确认：调用 ExtrudeManager.confirmExtrude
function onConfirm() {
  if (!props.extrudeMgr.selectedSketch) return;
  props.extrudeMgr.confirmExtrude();
}

// 取消：调用取消并重置本地值
function onCancel() {
  props.extrudeMgr.cancelDialog();
  startValue.value = 0;
  endValue.value = 10;
}
</script>

<style scoped>
@keyframes fade-in {
  from { opacity: 0; transform: translateY(30px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.animate-fade-in {
  animation: fade-in 0.25s cubic-bezier(.4,0,.2,1);
}
</style>
