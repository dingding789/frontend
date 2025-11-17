// src/core/sketch/services/SketchUploadService.ts
import { saveSketch, listSketches } from '../../infrastructure/api/sketchApi';
import { SketchNameService } from './SketchNameService';

export class SketchUploadService {
  constructor(
    private app: any,
    private manager: any,
    private nameService: SketchNameService
  ) {}

  async upload(jsonData: string) {
    let payload = JSON.parse(jsonData);
    payload.name = await this.nameService.ensureUniqueName(payload.name);
    const res = await saveSketch(JSON.stringify(payload));

    if (res.ok) return await res.json();
    //return await this.retryUpload(payload, res);
  }

  // /** 回退策略 */
  // private async retryUpload(payload: any, res: Response) {
  //   const text = await res.text().catch(() => '');
  //   console.warn('[SketchUploadService] 上传失败，尝试回退：', res.status, text);

  //   const retryPayload = {
  //     ...payload,
  //     name: `${payload.name}-retry`,
  //     items: (payload.items || []).filter((it: any) => ['point', 'line', 'arc'].includes(it.type?.toLowerCase())).slice(0, 100)
  //   };

  //   const res2 = await saveSketch(JSON.stringify(retryPayload));
  //   if (res2.ok) return await res2.json();

  //   // 第二次回退：类型名转大写 + 增加id
  //   const retryPayload2 = {
  //     ...retryPayload,
  //     items: retryPayload.items.map((it: any, i: number) => ({ ...it, type: it.type.toUpperCase(), id: i + 1 }))
  //   };
  //   const res3 = await saveSketch(JSON.stringify(retryPayload2));
  //   if (!res3.ok) throw new Error(`上传失败: ${res3.status}`);
  //   return await res3.json();
  // }
}
