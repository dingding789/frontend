<template>
  <div class="bc-dialog-panel">
    <div class="bc-dialog-header">
      <h3>设置边界条件</h3>
      <button class="close-btn" @click="handleClose">✕</button>
    </div>
    
    <div class="bc-dialog-content">
      <div class="form-item">
        <label>名称:</label>
        <input v-model="form.name" type="text" placeholder="例如: 固定底面" />
      </div>

      <div class="form-item">
        <label>类型:</label>
        <select v-model="form.type">
          <option value="fixed">固定约束 (Fixed)</option>
          <option value="force">集中力 (Force)</option>
          <option value="displacement">强制位移 (Displacement)</option>
        </select>
      </div>

      <div class="form-item">
        <label>施加位置:</label>
        <div class="target-selection">
          <div class="selection-mode">
            <button 
              :class="['mode-btn', { active: selectionMode === 'dropdown' }]"
              @click="selectionMode = 'dropdown'"
            >
              从下拉列表选择
            </button>
            <button 
              :class="['mode-btn', { active: selectionMode === 'interactive' }]"
              @click="startInteractiveSelection"
            >
              鼠标点击选择
            </button>
          </div>

          <!-- 下拉列表模式 -->
          <select v-if="selectionMode === 'dropdown'" v-model="form.target">
            <option disabled value="">请选择面...</option>
            <option v-for="g in store.physicalGroups" :key="g" :value="g">
              {{ g }}
            </option>
          </select>

          <!-- 交互选择模式 -->
          <div v-else class="interactive-info">
            <p class="hint">在3D视图中点击模型表面来选择面</p>
            <div class="selected-info" v-if="store.selectedFace">
              <strong>已选中:</strong> {{ store.selectedFace }}
              <button class="use-btn" @click="useSelectedFace">确认使用此面</button>
            </div>
            <div v-else class="waiting">等待选择...</div>
          </div>
        </div>
        <p class="hint" v-if="store.physicalGroups.length === 0 && selectionMode === 'dropdown'">
          (暂无物理组，请先划分网格)
        </p>
      </div>

      <div class="form-item" v-if="form.type !== 'fixed'">
        <label>数值 (X, Y, Z):</label>
        <div class="vec3-input">
          <input v-model.number="form.value[0]" type="number" placeholder="X" />
          <input v-model.number="form.value[1]" type="number" placeholder="Y" />
          <input v-model.number="form.value[2]" type="number" placeholder="Z" />
        </div>
      </div>
    </div>

    <div class="actions">
      <button @click="handleClose">取消</button>
      <button class="primary" @click="save">确定添加</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useCaeStore } from './useCaeStore';

const emit = defineEmits(['close']);
const store = useCaeStore();

const selectionMode = ref<'dropdown' | 'interactive'>('dropdown');

const form = reactive({
  name: 'BC_' + (store.boundaryConditions.length + 1),
  type: 'fixed',
  target: '',
  value: [0, 0, 0] as [number, number, number]
});

// 监听 form.target 变化（下拉列表选择）
watch(() => form.target, (newFaceName) => {
  if (newFaceName) {
    console.log(`[Dialog] 选择了面: ${newFaceName}`);
    // 触发全局事件来高亮面
    window.dispatchEvent(new CustomEvent('highlight-face', { 
      detail: { faceName: newFaceName } 
    }));
  } else {
    // 清除高亮
    window.dispatchEvent(new CustomEvent('highlight-face', { 
      detail: { faceName: '' } 
    }));
  }
});

function startInteractiveSelection() {
  selectionMode.value = 'interactive';
  store.isSelectingFace = true;
  store.selectedFace = null;
  store.selectedFaceData = null;
  console.log('启动交互式选择模式');
}

function useSelectedFace() {
  if (store.selectedFace) {
    form.target = store.selectedFace;
    selectionMode.value = 'dropdown';
    store.isSelectingFace = false;
    console.log('确认使用选中的面:', store.selectedFace);
  }
}

function handleClose() {
  // 清理选择状态
  store.isSelectingFace = false;
  store.selectedFace = null;
  store.selectedFaceData = null;
  emit('close');
}

function save() {
  if (!form.target) return alert("请选择施加位置");
  
  store.addBoundaryCondition({
    id: Date.now().toString(),
    name: form.name,
    type: form.type as 'fixed' | 'force' | 'displacement',
    target: form.target,
    value: form.value
  });
  
  // 清理选择状态
  store.isSelectingFace = false;
  store.selectedFace = null;
  store.selectedFaceData = null;
  
  emit('close');
}
</script>

<style scoped>
.bc-dialog-panel {
  position: fixed; top: 20px; right: 20px;
  background: white; border-radius: 8px; width: 380px;
  color: #333; max-height: 85vh; overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  z-index: 10000;
  border: 1px solid #e0e0e0;
  display: flex; flex-direction: column;
}

.bc-dialog-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 15px 20px; border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa; border-radius: 8px 8px 0 0;
  flex-shrink: 0;
}

.bc-dialog-header h3 {
  margin: 0; font-size: 14px; font-weight: bold;
  color: #333;
}

.close-btn {
  background: none; border: none; font-size: 20px; cursor: pointer;
  color: #666; padding: 0; width: 24px; height: 24px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 4px; transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(0,0,0,0.1); color: #333;
}

.bc-dialog-content {
  padding: 15px 20px;
  flex: 1; overflow-y: auto;
}

.form-item { margin-bottom: 15px; }
label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 12px;}
input, select { width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;}
.vec3-input { display: flex; gap: 5px; }
.vec3-input input { flex: 1; }

.target-selection {
  display: flex; flex-direction: column; gap: 10px;
}
.selection-mode {
  display: flex; gap: 8px;
}
.mode-btn {
  flex: 1; padding: 8px 12px; border: 2px solid #ccc; background: white;
  border-radius: 4px; cursor: pointer; font-size: 12px; transition: all 0.2s;
}
.mode-btn:hover {
  border-color: #666; background: #f5f5f5;
}
.mode-btn.active {
  border-color: #2196F3; background: #E3F2FD; color: #2196F3; font-weight: bold;
}

.interactive-info {
  border: 1px solid #ddd; border-radius: 4px; padding: 10px; background: #f9f9f9;
}
.interactive-info .hint {
  margin: 0 0 10px 0; font-size: 11px; color: #666; font-style: italic;
}
.selected-info {
  display: flex; flex-direction: column; gap: 8px;
  background: white; padding: 8px; border-radius: 4px;
  border: 2px solid #4CAF50;
}
.use-btn {
  padding: 6px 12px; background: #4CAF50; color: white; border: none;
  border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;
}
.use-btn:hover {
  background: #45a049;
}
.waiting {
  padding: 10px; text-align: center; color: #999; font-size: 12px;
  background: white; border-radius: 4px; border: 1px dashed #ccc;
}

.actions { 
  display: flex; justify-content: flex-end; gap: 10px; 
  margin-top: 20px; padding-top: 15px; border-top: 1px solid #e0e0e0;
  flex-shrink: 0;
}
button { padding: 6px 12px; cursor: pointer; border: 1px solid #ccc; background: #fff; border-radius: 4px;}
button.primary { background: #059669; color: white; border: none; }
.hint { font-size: 11px; color: #666; margin-top: 2px;}

/* 响应式设计：小屏幕时调整位置 */
@media (max-width: 768px) {
  .bc-dialog-panel {
    top: auto; right: auto; bottom: 0; left: 0;
    width: 100%; border-radius: 12px 12px 0 0;
    max-height: 75vh;
  }
}
</style>