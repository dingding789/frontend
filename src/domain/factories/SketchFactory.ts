import { PointItem, LineItem, ArcItem, CircleItem, RectItem } from '../../core/geometry/sketchs';

export class SketchFactory {
  static fromJSON(data: any): any {
    switch (data.type) {
      case 'point':
        return PointItem.fromJSON(data);
      case 'line':
        return LineItem.fromJSON(data);
      case 'arc':
        return ArcItem.fromJSON(data);
      case 'circle':
        return CircleItem.fromJSON(data);
      case 'rect':
        return RectItem.fromJSON(data);
      default:
        return null;
    }
  }
}

export default SketchFactory;
