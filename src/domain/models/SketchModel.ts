export interface SketchConstraint {
  type: string;          // 约束类型，如 'horizontal', 'vertical'
  entities: number[];    // 受约束的草图元素 id 列表
}

export interface SketchJSON {
  type: 'Sketch';
  id?: number; // 由后端生成，前端上传时不发送
  name: string;
  plane: string;
  origin: [number, number, number];
  items: any[];              // 草图元素序列化数据
  constraints: SketchConstraint[]; // 草图约束
}

export {};