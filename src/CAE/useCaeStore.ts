import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';

export interface BoundaryCondition {
  id: string;
  name: string;
  type: 'fixed' | 'force' | 'displacement';
  target: string;
  value: [number, number, number];
}

export const useCaeStore = defineStore('cae', () => {
  const modelUrl = ref<string | null>(null);
  const sessionId = ref<string | null>(null);
  const isProcessing = ref(false);
  const loadingText = ref('');
  
  // 视图模式: geometry(几何), mesh(网格), result(结果云图)
  const viewMode = ref<'geometry' | 'mesh' | 'result'>('geometry');
  
  const physicalGroups = ref<string[]>([]);
  const boundaryConditions = ref<BoundaryCondition[]>([]);
  const groupsData = ref<any>(null); // 存储从后端获取的物理组节点映射
  
  // 交互式面选择状态
  const isSelectingFace = ref(false); // 是否正在选择面
  const selectedFace = ref<string | null>(null); // 选中的面名称
  const selectedFaceData = ref<any>(null); // 选中的面的详细数据（用于高亮）

  const API_BASE = 'http://127.0.0.1:8000';

  async function uploadModel(file: File) {
    isProcessing.value = true;
    loadingText.value = '正在导入几何模型...';
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API_BASE}/api/import`, formData);
      if (res.data) {
        modelUrl.value = res.data.model_url;
        sessionId.value = res.data.session_id;
        viewMode.value = 'geometry';
        physicalGroups.value = [];
        boundaryConditions.value = [];
      }
    } catch (e) { alert("导入失败"); } 
    finally { isProcessing.value = false; }
  }

  async function generateMesh() {
    if (!sessionId.value) return alert("请先导入");
    isProcessing.value = true;
    loadingText.value = '正在划分网格...';
    try {
      const res = await axios.post(`${API_BASE}/api/mesh`, { session_id: sessionId.value });
      if (res.data) {
        viewMode.value = 'mesh';
        // 先获取 groups 数据，再更新 modelUrl 触发渲染
        if (res.data.groups_url) {
          await fetchGroups(res.data.groups_url);
          console.log('[Store] groupsData 已加载，面数量:', Object.keys(groupsData.value || {}).length);
        }
        modelUrl.value = res.data.mesh_url;
      }
    } catch (e) { alert("网格划分失败"); } 
    finally { isProcessing.value = false; }
  }

  async function fetchGroups(url: string) {
    try {
      const res = await axios.get(url);
      physicalGroups.value = Object.keys(res.data).filter(k => k.startsWith('Face'));
      groupsData.value = res.data;  // 保存完整的节点映射数据
    } catch (e) {}
  }

  function addBoundaryCondition(bc: BoundaryCondition) {
    boundaryConditions.value.push(bc);
  }

  async function buildSimulation() {
    if (!sessionId.value) return;
    isProcessing.value = true;
    loadingText.value = '正在生成求解文件...';
    try {
      await axios.post(`${API_BASE}/api/simulation/build`, {
        session_id: sessionId.value,
        material: { elastic_modulus: 210000, poisson_ratio: 0.3 },
        bcs: boundaryConditions.value
      });
      alert("构建成功！可以开始求解了。");
    } catch (e) { alert("构建失败"); } 
    finally { isProcessing.value = false; }
  }

  // === 新增：求解并获取结果 ===
  async function solveSimulation() {
    if (!sessionId.value) return;
    isProcessing.value = true;
    loadingText.value = '正在求解 (CalculiX) ...';
    
    try {
      // 调用后端求解接口
      const res = await axios.post(`${API_BASE}/api/simulation/solve`, {
        session_id: sessionId.value
      });

      if (res.data && res.data.result_url) {
        // 更新模型 URL 为结果文件 (.vtu)
        modelUrl.value = res.data.result_url;
        
        // 切换到结果视图模式
        viewMode.value = 'result';
        console.log("求解成功，加载云图:", modelUrl.value);
      }
    } catch (e) {
      console.error(e);
      alert("求解过程出错，请检查后端控制台");
    } finally {
      isProcessing.value = false;
    }
  }

  return {
    modelUrl, sessionId, isProcessing, loadingText, viewMode,
    physicalGroups, boundaryConditions, groupsData,
    isSelectingFace, selectedFace, selectedFaceData,
    uploadModel, generateMesh, addBoundaryCondition, buildSimulation, solveSimulation
  };
});