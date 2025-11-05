// 草图相关工具函数
import { SketchPlaneName } from '../managers/sketchManager';
import * as THREE from 'three';

export function getPlaneName(plane: THREE.Plane): SketchPlaneName {
  const normal = plane.normal;
  if (Math.abs(normal.x) > 0.9) return 'YZ';
  if (Math.abs(normal.y) > 0.9) return 'XZ';
  return 'XY';
}

export function resolveSketchName(sketchName: string, sketchList: any[]): string {
  const raw = (sketchName ?? '').trim();
  if (!raw || raw === '草图') {
    const re = /^草图\s*(\d+)$/;
    let maxN = 0;
    for (const it of sketchList) {
      const name = String(it?.name ?? '');
      const m = name.match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!Number.isNaN(n)) maxN = Math.max(maxN, n);
      }
    }
    return `草图${maxN + 1}`;
  }
  return raw;
}
