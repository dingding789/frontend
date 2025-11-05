// src/core/sketch/services/SketchNameService.ts
import { listSketches } from '../../infrastructure/api/sketchApi';

export class SketchNameService {
  async ensureUniqueName(name: string): Promise<string> {
    const raw = (name ?? '').trim();
    const baseIsDefault = (!raw || raw === '草图' || /^草图\s*\d+$/.test(raw));

    try {
      const res = await listSketches();
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const names = (data?.sketches ?? []).map((it: any) => String(it.name ?? ''));

      // 默认命名递增
      if (baseIsDefault) {
        const re = /^草图\s*(\d+)$/;
        let max = 0;
        for (const n of names) {
          const m = n.match(re);
          if (m) {
            const num = parseInt(m[1], 10);
            if (!Number.isNaN(num)) max = Math.max(max, num);
          }
        }
        return `草图${max + 1}`;
      }

      // 若已存在则加后缀
      if (!names.includes(raw)) return raw;
      const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re2 = new RegExp(`^${esc}-(\\d+)$`);
      let maxK = 0;
      for (const n of names) {
        const m = n.match(re2);
        if (m) {
          const k = parseInt(m[1], 10);
          if (!Number.isNaN(k)) maxK = Math.max(maxK, k);
        }
      }
      return `${raw}-${maxK + 1}`;
    } catch {
      return baseIsDefault ? `草图-${Date.now()}` : `${raw}-${Date.now()}`;
    }
  }
}
