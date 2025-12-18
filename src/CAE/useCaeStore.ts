import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';

export const useCaeStore = defineStore('cae', () => {
  const modelUrl = ref<string | null>(null);
  const sessionId = ref<string | null>(null);
  const isProcessing = ref(false);
  const loadingText = ref('');
  
  // 新增状态：'geometry' (几何) 或 'mesh' (网格)
  const viewMode = ref<'geometry' | 'mesh'>('geometry');

  const API_BASE = 'http://localhost:8000';

  // 1. 上传并导入
  async function uploadModel(file: File) {
    isProcessing.value = true;
    loadingText.value = '正在导入几何模型...';
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_BASE}/api/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data) {
        modelUrl.value = res.data.model_url;
        sessionId.value = res.data.session_id;
        
        // 【关键】导入成功后，设置为“几何模式”
        viewMode.value = 'geometry';
      }
    } catch (error) {
      console.error("导入失败:", error);
      alert("导入失败，请检查后端服务");
    } finally {
      isProcessing.value = false;
    }
  }

  // 2. 划分网格
  async function generateMesh() {
    if (!sessionId.value) {
      alert("请先导入模型！");
      return;
    }

    isProcessing.value = true;
    loadingText.value = '正在划分网格 (GMSH)...';

    try {
      const res = await axios.post(`${API_BASE}/api/mesh`, {
        session_id: sessionId.value
      });

      if (res.data && res.data.mesh_url) {
        modelUrl.value = res.data.mesh_url;
        
        // 【关键】网格生成后，设置为“网格模式”
        viewMode.value = 'mesh';
        console.log("网格生成成功，切换显示模式");
      }
    } catch (error) {
      console.error("网格划分失败:", error);
      alert("网格划分出错");
    } finally {
      isProcessing.value = false;
    }
  }

  return {
    modelUrl,
    sessionId,
    isProcessing,
    loadingText,
    viewMode, // 别忘了导出这个变量
    uploadModel,
    generateMesh
  };
});