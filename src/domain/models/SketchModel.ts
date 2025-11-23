import * as THREE from 'three';


export interface SketchConstraint {
  type: string;          // 约束类型，如 'horizontal', 'vertical'
  entities: number[];    // 受约束的草图元素 id 列表
}

export interface SketchJSON {
  type: 'Sketch';
  id?: number; // 由后端生成，前端上传时不发送
  frontend_id: string;   // 前端生成的唯一 ID
  name: string;
  planeNormal: THREE.Vector3; // 草图平面法向量
  planeOrigin: THREE.Vector3; // 草图平面原点
  items: any[];              // 草图元素序列化数据
  constraints: SketchConstraint[]; // 草图约束
  created_at?;         // 创建时间
}

export {};