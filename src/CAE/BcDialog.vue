<template>
  <div class="bc-dialog-mask">
    <div class="bc-dialog">
      <h3>设置边界条件</h3>
      
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
        <label>施加位置 (物理组):</label>
        <select v-model="form.target">
          <option disabled value="">请选择面...</option>
          <option v-for="g in store.physicalGroups" :key="g" :value="g">
            {{ g }}
          </option>
        </select>
        <p class="hint" v-if="store.physicalGroups.length === 0">
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

      <div class="actions">
        <button @click="$emit('close')">取消</button>
        <button class="primary" @click="save">确定添加</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { useCaeStore } from './useCaeStore';

const emit = defineEmits(['close']);
const store = useCaeStore();

const form = reactive({
  name: 'BC_' + (store.boundaryConditions.length + 1),
  type: 'fixed',
  target: '',
  value: [0, 0, 0] as [number, number, number]
});

function save() {
  if (!form.target) return alert("请选择施加位置");
  
  store.addBoundaryCondition({
    id: Date.now().toString(),
    ...form
  });
  emit('close');
}
</script>

<style scoped>
.bc-dialog-mask {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.5); z-index: 10000;
  display: flex; align-items: center; justify-content: center;
}
.bc-dialog {
  background: white; padding: 20px; border-radius: 8px; width: 320px;
  color: #333;
}
.form-item { margin-bottom: 15px; }
label { display: block; margin-bottom: 5px; font-weight: bold; font-size: 12px;}
input, select { width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;}
.vec3-input { display: flex; gap: 5px; }
.actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
button { padding: 6px 12px; cursor: pointer; border: 1px solid #ccc; background: #fff; border-radius: 4px;}
button.primary { background: #059669; color: white; border: none; }
.hint { font-size: 11px; color: #666; margin-top: 2px;}
</style>