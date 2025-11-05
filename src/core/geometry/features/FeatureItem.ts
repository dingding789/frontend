// FeatureItem.ts
// 特征基类及拉伸、旋转等子类定义

/**
 * 特征基类，所有特征（如拉伸、旋转等）都应继承此类
 */
export abstract class FeatureItem {
  type: string;
  plane: string;
  id: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(type: string, plane: string = 'XY', id?: string, name?: string) {
    this.type = type;
    this.plane = plane;
    this.id = id || '';
    this.name = name;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * 更新特征的更新时间
   */
  touch() {
    this.updatedAt = new Date();
  }

  /**
   * 序列化为JSON对象
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      plane: this.plane,
      name: this.name,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

