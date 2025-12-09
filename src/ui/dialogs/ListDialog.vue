<template>
  <div
    class="fixed z-50 pointer-events-auto"
    :style="{ left: x + 'px', top: y + 'px' }"
  >
    <div class="relative w-36 rounded-lg bg-transparent" @click.stop>
      <div class="rounded-lg bg-gray-800/95 border border-gray-700 shadow-lg p-2">
        <div class="space-y-1">
          <button
            class="w-full px-2 py-1.5 rounded text-sm bg-blue-600 hover:bg-blue-500 text-white transition"
            @click="onEdit"
          >编辑</button>
          <button
            class="w-full px-2 py-1.5 rounded text-sm bg-gray-600 hover:bg-gray-500 text-white transition"
            @click="onHide"
          >{{ hidden ? '显示' : '隐藏' }}</button>
          <button
            class="w-full px-2 py-1.5 rounded text-sm bg-red-600 hover:bg-red-500 text-white transition"
            @click="onDelete"
          >删除</button>
        </div>
      </div>
      <button
        class="absolute -top-2 -right-2 bg-gray-800/90 text-gray-300 hover:text-gray-100 rounded-full w-5 h-5 flex items-center justify-center text-xs"
        @click="$emit('close')"
      >✕</button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted } from 'vue';
import AppManager from '../../core/AppManager';
import { SketchEditManager } from '../../core/managers/sketchManager/SketchEditManager';
import { SketchHideManager } from '../../core/managers/sketchManager/SketchHide';

const props = defineProps<{
  id: number | string;
  name?: string;
  isHidden?: boolean;
  x: number;
  y: number;
}>();

const hidden = computed(() => !!props.isHidden);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

// 初始化管理器和应用实例
const app = AppManager.getInstance();
const sketchMgr = app.sketchMgr;

// 初始化 SketchHideManager
const hideMgr: SketchHideManager =
  (sketchMgr as any).hideMgr || new SketchHideManager(sketchMgr);
(sketchMgr as any).hideMgr = hideMgr;

// 初始化 SketchEditManager
const sketchEditManager: SketchEditManager =
  (sketchMgr as any).sketchEditManager || new SketchEditManager(app, sketchMgr);
(sketchMgr as any).sketchEditManager = sketchEditManager;

// 解析草图项（用于编辑功能）
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

// 编辑功能：对应 List.vue 的双击逻辑
async function onEdit() {
  const id = props.id;
  console.info('编辑草图,id =', id);

  const items = resolveSketchItemsById(id);
  console.info('草图项数量=', items?.length ?? 0);

  // 保存相机状态
  if (typeof sketchEditManager.saveCameraState === 'function') {
    sketchEditManager.saveCameraState();
  }

  // 聚焦到草图平面
  const ok = sketchEditManager.focusCameraToSketchPlane(id);
  if (!ok) {
    console.warn('编辑未能聚焦到草图平面, id =', id);
  }

  // 隐藏其他草图
  hideMgr.hideExcept(id);

  // 启动编辑会话
  const started = sketchEditManager.startEditSession(id, { clearOld: true });
  if (!started) {
    console.warn('未能进入编辑会话, id =', id);
    return;
  }

  app.renderOnce?.();
  emit('close'); // 编辑后关闭对话框
}

// 隐藏功能：对应 List.vue 的隐藏逻辑
function onHide() {
  const id = props.id;
  // 调用 SketchHideManager 的切换隐藏/显示方法
  hideMgr.toggleById(id);
  emit('close'); // 操作后关闭对话框
}

// 删除功能：对应 List.vue 的删除逻辑
async function onDelete() {
  const id = props.id;
  const n = Number(id);
  if (!Number.isNaN(n)) {
    await sketchMgr.sketchData.deleteSketchByID(n);
  }
  emit('close'); // 删除后关闭对话框
}

// 点击其它区域关闭（透明背景无遮罩）
function onGlobalClick(ev: MouseEvent) {
  const path = ev.composedPath?.() as any[] | undefined;
  // 简单处理：任何全局点击都关闭
  emit('close');
}
onMounted(() => window.addEventListener('click', onGlobalClick, { capture: true }));
onUnmounted(() => window.removeEventListener('click', onGlobalClick, { capture: true }));
</script>

<style scoped>
</style>