import { saveSketch, updateSketch, listSketches } from '../../infrastructure/api/sketchApi';
import { SketchNameService } from './SketchNameService';

export class SketchUploadService {
  constructor(
    private app: any,
    private manager: any,
    private nameService: SketchNameService
  ) {}

  async upload(jsonData: string) {
    let payload = JSON.parse(jsonData);
    
    // 检查编辑管理器是否处于编辑模式（防止ID丢失时误判）
    const sketchEditManager = this.manager?.sketchEditManager;
    const isEditingFromManager = sketchEditManager && 
      typeof sketchEditManager.getIsEditingMode === 'function' &&
      sketchEditManager.getIsEditingMode();
    
    // 如果编辑管理器标记为编辑模式，即使payload没有id也认为是更新
    const isCreate = !isEditingFromManager && (payload.id == null || payload.id === undefined);

    let res: Response;
    if (!isCreate) {
      // 更新操作：使用专门的 edit 接口
      const editId = payload.id || (sketchEditManager && (sketchEditManager as any).currentEditingSketchId);
      if (editId) {
        payload.id = editId; // 确保payload有id
      }
     // console.log('更新草图,ID:', payload.id, '名称:', payload.name);
      res = await updateSketch(JSON.stringify(payload));
    } else {
      payload.name = await this.nameService.ensureUniqueName(payload.name);
      //console.log('新建草图，名称:', payload.name);
      res = await saveSketch(JSON.stringify(payload));
    }

    if (res.ok) {
      const result = await res.json();
      //console.log('后端响应:', result);
      // 后端返回格式：{status: "ok", message: "...", id: ...}
      // 确保返回的 id 字段可用
      if (result?.id != null) {
        // 对于更新操作，确保返回的 id 与请求的 id 一致
        if (!isCreate && result.id !== payload.id) {
          console.warn('更新操作返回的ID与请求ID不一致:', result.id,'vs', payload.id);
        }
      }
      // 新建时：拿到新 ID 后回填本地，保证后续双击/回滚编辑使用正确 id
      if (isCreate && result?.id != null) {
        try {
          // 1) 回填到当前正在编辑的 sketch
          if (this.manager?.sketch && (this.manager.sketch.id == null || this.manager.sketch.id === undefined)) {
            this.manager.sketch.id = result.id;
            // 同步名称（确保和 payload 一致）
            if (!this.manager.sketch.name) this.manager.sketch.name = payload.name;
          }

          // 2) 更新 allSketch：按“名称一致且 id 为空”的项回填 id；找不到则新增
          if (Array.isArray(this.manager?.allSketch)) {
            const i = this.manager.allSketch.findIndex(
              (s: any) => (s?.id == null || s.id === undefined) && s?.name === payload.name
            );
            if (i !== -1) {
              this.manager.allSketch[i].id = result.id;
              this.manager.allSketch[i].name = payload.name;
            } else {
              this.manager.allSketch.push({
                ...(this.manager.sketch || {}),
                id: result.id,
                name: payload.name,
              });
            }
          }

          // 4) 轻量刷新：从后端拉取一次列表，保持顺序/时间戳一致，并重绘
          await this.manager?.sketchData?.loadAll?.();
          this.app?.renderOnce?.();
        } catch (e) {
          console.warn('新建草图回填本地 id 失败：', e);
        }
      }
      return result;
    } else {
      // const errorText = await res.text().catch(() => '');
      // console.error('上传失败:', res.status, errorText);
      // throw new Error(`上传失败: ${res.status} - ${errorText}`);
    }
  }

}
