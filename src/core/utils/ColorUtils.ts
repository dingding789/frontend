// ColorUtils// ColorUtils.ts
import * as THREE from 'three';

/** HEX 转 THREE.Color */
export function hexToThreeColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

/** RGB 转 HEX */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/** 颜色反色 */
export function invertColor(hex: string): string {
  const c = hex.startsWith('#') ? hex.slice(1) : hex;
  const num = parseInt(c, 16);
  const inverted = (0xFFFFFF ^ num).toString(16).padStart(6, '0');
  return `#${inverted}`;
}

/** 调整亮度（factor: 0~1 变暗，>1 变亮） */
export function adjustBrightness(hex: string, factor: number): string {
  let c = hex.startsWith('#') ? hex.slice(1) : hex;
  let num = parseInt(c, 16);
  let r = Math.min(255, Math.max(0, ((num >> 16) & 0xFF) * factor));
  let g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) * factor));
  let b = Math.min(255, Math.max(0, (num & 0xFF) * factor));
  return rgbToHex(r, g, b);
}

// 更多颜色相关工具可按需扩展