// SketchItem.ts
import * as THREE from 'three';
export type SketchType = 'point'|'circle' | 'rect' | 'line' | 'spline'| 'arc';
export abstract class SketchItem {
  // 公共属性，表示当前的3D对象，初始值为null
  public object3D: THREE.Object3D | null = null;
  public type: SketchType;

  public id: number | string = '';
  public name: string = '';
  public createdAt: Date = new Date();
  public updatedAt: Date = new Date();

  constructor(type: SketchType) {
    this.type = type;
  }
  // 抽象方法，用于绘制正式对象到场景
  abstract draw(scene: THREE.Scene): void;

  // 抽象方法，用于绘制预览（临时对象）到场景
  abstract drawPreview(scene: THREE.Scene, cursorPos?: THREE.Vector3): void;

  // 移除对象的方法
  remove(scene: THREE.Scene) {
    if (this.object3D) {
      // 从场景中移除3D对象
      scene.remove(this.object3D);
      // 将object3D属性设置为null
      this.object3D = null;
      
    }
  }

  setName(name: string) {
    this.name = name;
  }

  setId(id: number | string) {
    this.id = id;
  }

  updateTimestamp() {
    this.updatedAt = new Date();
  }

  clone(): this {
    return Object.assign(Object.create(Object.getPrototypeOf(this)), this);
  }

  // 通用序列化接口
  abstract toJSON(): any;

  // 子类静态反序列化工厂
  static fromJSON(_data: any): SketchItem {
    throw new Error('fromJSON must be implemented in subclass');
  }

  
}
