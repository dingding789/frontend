// RectExtrudeItem.ts
// 矩形拉伸特征类，继承ExtrudeItem
import { ExtrudeItem } from './ExtrudeItem';

export abstract class RectExtrudeItem extends ExtrudeItem {
  p1: [number, number, number]; // 左下角
  p2: [number, number, number]; // 右上角
  constructor(p1: [number, number, number], p2: [number, number, number], plane: string = 'XY', id?: string, name?: string) {
    super('rect', plane, id, name);
    this.p1 = p1;
    this.p2 = p2;
  }
}
