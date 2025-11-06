<template>
  <div v-if="isOpen" class="fixed top-16 left-4 z-50 bg-gray-800 text-white rounded shadow-lg border border-gray-700 w-64">
    <div class="px-4 py-2 border-b border-gray-700 font-medium">样条曲线</div>

    <div class="p-3">
      <div class="space-y-3">
        <div class="text-sm text-gray-300">绘制模式</div>
        <div class="space-y-2">
          <button
            class="w-full px-3 py-1 rounded text-left"
            :class="selectedMode === 'passPoint' ? 'bg-cyan-700 hover:bg-cyan-600' : 'bg-gray-700 hover:bg-gray-600'"
            @click="chooseMode('passPoint')"
          >
            通过点
          </button>

          <button
            class="w-full px-3 py-1 rounded text-left"
            :class="selectedMode === 'dependencePoint' ? 'bg-cyan-700 hover:bg-cyan-600' : 'bg-gray-700 hover:bg-gray-600'"
            @click="chooseMode('dependencePoint')"
          >
            根据极点
          </button>
        </div>

        
      </div>

      <div class="flex justify-end gap-2 pt-3">
        <button class="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600" @click="onCancel">取消</button>
        <button class="px-3 py-1 rounded bg-cyan-700 hover:bg-cyan-600" @click="onFinish">完成</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import { SplineCurveItem } from '../../core/geometry/sketchs/SplineCurveItem';

type SplineModeUI = 'passPoint' | 'dependencePoint';

interface Props {
  open: boolean;
  app?: any;
  manager?: any;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'select', mode: SplineModeUI): void;
  (e: 'finish', mode: SplineModeUI): void;
  (e: 'cancel'): void;
  (e: 'close'): void;
}>();

// v-model:open 绑定
const isOpen = computed({
  get: () => props.open,
  set: (v: boolean) => emit('update:open', v),
});

// 默认模式：通过点
const selectedMode = ref<SplineModeUI>('passPoint');

// 打开时通知父组件当前选择（与 ArcDialog / CircleDialog 保持一致）
watch(() => props.open, (newVal) => {
  if (newVal) emit('select', selectedMode.value);
});

// 切换模式
function chooseMode(mode: SplineModeUI) {
  selectedMode.value = mode;
  emit('select', mode);
}

// 完成：调用样条静态收尾方法（会隐藏句柄并退出样条工具），然后关闭对话框
function onFinish() {
  // 若提供 app 和 manager，则使用类方法统一处理落地/隐藏/退出工具
  if (props.app && props.manager && typeof SplineCurveItem.finishAndExitTool === 'function') {
    try {
      SplineCurveItem.finishAndExitTool(props.app, props.manager);
    } catch (e) {
      // 兜底：若出错仍通知上层
    }
  } else {
    // 回退行为：仅通知父组件 finish（上层可自行处理）
    emit('finish', selectedMode.value);
  }

  emit('close');
  isOpen.value = false;
}

// 取消：通知并关闭
function onCancel() {
  emit('cancel');
  emit('close');
  isOpen.value = false;
}
</script>

<style scoped>
/* 与其它对话框保持一致的基础样式，可按需调整 */
</style>