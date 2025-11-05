<template>
  <div class="p-4 bg-gray-900 rounded-lg shadow min-h-[80px] max-h-[950px] overflow-auto">
    <!-- 标题栏 -->
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

    <!-- 列表区域 -->
    <div v-if="list.length === 0" class="text-gray-400 italic text-sm">
      暂无草图，请先绘制或保存。
    </div>

    <ul v-else class="space-y-2">
      <li
        v-for="item in list"
        :key="item.id"
        class="p-2 border border-gray-700 rounded flex justify-between items-center hover:bg-gray-800 transition"
        :class="{ 'bg-blue-800': selectedId === item.id }"
      >
        <div class="flex-1 text-gray-200 truncate">
          {{ item.name }}
        </div>

        <div class="flex space-x-2">
          <!-- <button
            class="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded"
            @click="load(item.id)"
          >
            加载
          </button> -->
          <button
            class="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded"
            @click="remove(item.id)"
          >
            删除
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue'
import AppManager from '../../core/scene/SceneManager';
import SketchManager from '../../core/managers/sketchManager/SketchManager';
import { ref } from 'vue'
const app = AppManager.getInstance();
const sketch = app.sketchMgr;
const selectedId = ref<number | null>(null);
const list = sketch.sketchList;

// 挂载时加载草图列表
onMounted(() => {
  sketch.sketchData.loadAll()
  
})
/** 刷新草图列表 */
function refresh() {
  sketch.sketchData.loadAll()
}
/** 加载指定草图 */
// async function load(id: number) {
//   selectedId.value = id
//   await sketch.loadById(id)
// }

/** 删除指定草图 */
async function remove(id: number) {
  //if (!confirm('确定要删除该草图吗？')) return
  await sketch.sketchData.deleteSketchByID(id)
}
</script>
