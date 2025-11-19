<template>
  <div class="p-4 bg-gray-900 rounded-lg shadow min-h-[80px] max-h-[950px] overflow-auto">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold text-gray-200">草图列表</h2>
      <button
        class="flex items-center text-sm text-gray-300 hover:text-white transition"
        @click="refresh"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M4 4v6h6M20 20v-6h-6M4 10a8 8 0 0113.657-5.657L20 8M20 14a8 8 0 01-13.657 5.657L4 16" />
        </svg>
        刷新
      </button>
    </div>

    <div v-if="list.length === 0" class="text-gray-400 italic text-sm">
      暂无草图，请先绘制或保存。
    </div>

    <ul v-else class="space-y-2">
      <li
        v-for="item in list"
        :key="item.id"
        class="p-2 border border-gray-700 rounded flex justify-between items-center hover:bg-gray-800 transition cursor-pointer"
        :class="{ 'bg-blue-800': selectedId !== null && Number(item.id) === selectedId }"
        :style="{ backgroundColor: selectedId !== null && Number(item.id) === selectedId ? '#1e40af' : '' }"
        @mousedown="toggle(item.id)"
        tabindex="0"
        @keydown.enter.prevent="toggle(item.id)"
      >
        <div class="flex-1 text-gray-200 truncate">
          {{ item.name }}
        </div>
        <div class="flex space-x-2">
          <button
            class="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded"
            @mousedown.stop="remove(item.id)"
          >
            删除
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';
import AppManager from '../../core/scene/SceneManager';

const app = AppManager.getInstance();
const sketch = app.sketchMgr;
const selectedId = ref<number | null>(null);
const list = sketch.sketchList;

const norm = (id: any) => {
  const n = Number(id);
  return Number.isNaN(n) ? null : n;
};

// 监听 3D 侧事件同步列表高亮
function onSketchPicked(id: number | string | null) {
  selectedId.value = id == null ? null : norm(id);
}

onMounted(() => {
  sketch.sketchData.loadAll();
  (sketch as any)?.on?.('sketch-picked', onSketchPicked);
});

onUnmounted(() => {
  (sketch as any)?.off?.('sketch-picked', onSketchPicked);
});

function refresh() {
  sketch.sketchData.loadAll();
}

// 列表点击：高亮/取消（与 3D 同步）
async function toggle(id: number | string) {
  const nId = norm(id);
  if (nId == null) return;
  const mgr = (sketch as any).highlightMgr || (app as any).highlightMgr;
  if (!mgr) return;

  // 取消
  if (selectedId.value === nId) {
    selectedId.value = null;
    if (typeof mgr.clearHighlight === 'function') {
      mgr.clearHighlight();
    } else {
      mgr.highlight?.(null, false);
      (sketch as any)?.emit?.('sketch-picked', null);
      app.renderOnce?.();
    }
    return;
  }

  // 新高亮
  selectedId.value = nId;
  try {
    if (typeof mgr.highlightBySketchId === 'function') {
      await mgr.highlightBySketchId(nId); // 内部已 emit
    } else {
      const idx = sketch.sketchList.value.findIndex((it: any) => norm(it.id) === nId);
      if (idx >= 0 && sketch.allSketchItems && sketch.allSketchItems[idx]) {
        mgr.highlight?.(sketch.allSketchItems[idx], true);
        (sketch as any)?.emit?.('sketch-picked', nId);
      }
    }
    app.renderOnce?.();
  } catch (e) {
    console.error('高亮失败', e);
  }
}

async function remove(id: number) {
  await sketch.sketchData.deleteSketchByID(id);
}
</script>
