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
        @click="handleSketchClick(item.id)"
        @dblclick="handleSketchDblClick(item.id)"
        tabindex="0"
        @keydown.enter.prevent="handleSketchClick(item.id)"
      >
        <div class="flex-1 text-gray-200 truncate">
          {{ item.name }}
        </div>
        <div class="flex space-x-2">
          <button
            class="w-6 h-6 flex items-center justify-center rounded transition"
            :class="hideMgr.isHidden(item.id)
              ? 'bg-gray-700 hover:bg-gray-600'
              : 'bg-gray-600 hover:bg-gray-500'"
            @mousedown.stop="toggleHide(item.id)"
            :title="hideMgr.isHidden(item.id) ? '显示草图' : '隐藏草图'"
            aria-label="切换可见性"
          >
            <svg v-if="!hideMgr.isHidden(item.id)" xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                 class="w-4 h-4 text-yellow-300">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                 class="w-4 h-4 text-gray-300">
              <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.86 21.86 0 0 1 5.06-6.94M9.53 9.53a3 3 0 0 0 4.24 4.24"/>
              <path d="M1 1l22 22"/>
            </svg>
          </button>
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
import AppManager from '../../core/AppManager';
import { SketchEditManager } from '../../core/managers/sketchManager/SketchEditManager';
import { SketchHideManager } from '../../core/managers/sketchManager/SketchHide';

const app = AppManager.getInstance();
const sketchMgr = app.sketchMgr;
const selectedId = ref<number | null>(null);
const list = sketchMgr.sketchList;

const hideMgr: SketchHideManager =
  (sketchMgr as any).hideMgr || new SketchHideManager(sketchMgr);
(sketchMgr as any).hideMgr = hideMgr;

const sketchEditManager: SketchEditManager =
  (sketchMgr as any).sketchEditManager || new SketchEditManager(app, sketchMgr);
(sketchMgr as any).sketchEditManager = sketchEditManager;

function normalizeId(id: any): number | null {
  const n = Number(id);
  return Number.isNaN(n) ? null : n;
}

function resolveSketchItemsById(sketchId: number | string): any[] | null {
  const sid = String(sketchId);
  const gArr = (sketchMgr as any).allSketch;
  if (Array.isArray(gArr)) {
    const gHit = gArr.find((g: any) =>
      String(g?.id) === sid ||
      (g?.items?.[0] && String(g.items[0].id) === sid) ||
      (g?.items?.[0]?.object3D?.userData?.sketchItem && 
       String(g.items[0].object3D.userData.sketchItem.id) === sid)
    );
    if (gHit?.items?.length) return gHit.items;
  }
  return null;
}

function refresh() {
  sketchMgr.sketchData.loadAll();
}

async function handleSketchClick(id: number | string) {
  const numericId = normalizeId(id);
  if (numericId == null) return;

  const highlightManager = (sketchMgr as any).highlightMgr || (app as any).highlightMgr;
  if (!highlightManager) return;

  if (selectedId.value === numericId) {
    selectedId.value = null;
    if (typeof highlightManager.clearHighlight === 'function') {
      highlightManager.clearHighlight();
    } else {
      highlightManager.highlight?.(null, false);
      (sketchMgr as any)?.emit?.('sketch-picked', null);
      app.renderOnce?.();
    }
    return;
  }

  selectedId.value = numericId;
  const items = resolveSketchItemsById(numericId);
  if (!items || items.length === 0) {
    console.warn('未找到草图数据, id =', numericId);
    return;
  }

  try {
    if (typeof highlightManager.highlightBySketchId === 'function') {
      await highlightManager.highlightBySketchId(numericId);
    } else {
      highlightManager.highlight?.(items, true);
      (sketchMgr as any)?.emit?.('sketch-picked', numericId);
      if (typeof (window as any).setListSelectedId === 'function') {
        (window as any).setListSelectedId(numericId);
      }
    }
    app.renderOnce?.();
  } catch (e) {
    console.error('高亮失败', e);
  }
}

async function handleSketchDblClick(id: number | string) {
  console.info('[List] 双击草图，id =', id);

  const items = resolveSketchItemsById(id);
  console.info('[List] 草图项数量 =', items?.length ?? 0);

  if (typeof sketchEditManager.saveCameraState === 'function') {
    sketchEditManager.saveCameraState();
  }

  const ok = sketchEditManager.focusCameraToSketchPlane(id);
  if (!ok) {
    console.warn('双击未能聚焦到草图平面, id =', id);
  }

  hideMgr.hideExcept(id);

  const started = sketchEditManager.startEditSession(id, { clearOld: true });
  if (!started) {
    console.warn('未能进入编辑会话, id =', id);
    return;
  }

  app.renderOnce?.();
}

function toggleHide(id: number | string) {
  hideMgr.toggleById(id);
}

async function remove(id: number) {
  await sketchMgr.sketchData.deleteSketchByID(id);
}

function onSketchPicked(id: number | string | null) {
  selectedId.value = id == null ? null : Number(id);
}

onMounted(() => {
  sketchMgr.sketchData.loadAll();
  (sketchMgr as any)?.on?.('sketch-picked', onSketchPicked);
});

onUnmounted(() => {
  (sketchMgr as any)?.off?.('sketch-picked', onSketchPicked);
});

(window as any).setListSelectedId = (id: number | string | null) => {
  selectedId.value = id == null ? null : Number(id);
};
</script>

<style scoped>
.bg-blue-800 {
  background-color: #1e40af !important;
}

button.w-6.h-6 {
  padding: 0;
  line-height: 1;
}
</style>
