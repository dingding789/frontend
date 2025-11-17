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


  /**
    * 根据三个点计算出一个平面的基底，包括法向量和两个正交的单位向量。
    * 这些向量可以用来定义一个平面的局部坐标系。
    *
    * @param p1 - 平面上的第一点，类型为THREE.Vector3
    * @param p2 - 平面上的第二点，类型为THREE.Vector3
    * @param p3 - 平面上的第三点，类型为THREE.Vector3
    * @returns 返回一个包含法向量normal和两个正交单位向量u与v的对象
    */
  makePlaneBasis(p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3) {
    // 计算从p1指向p2的向量v12
    const v12 = new THREE.Vector3().subVectors(p2, p1);
    // 计算从p1指向p3的向量v13
    const v13 = new THREE.Vector3().subVectors(p3, p1);
    // 计算平面的法向量normal，它是v12与v13的叉乘结果
    let normal = new THREE.Vector3().crossVectors(v12, v13);
    // 计算法向量的长度
    const len = normal.length();
    // 如果法向量的长度小于一个很小的数（1e-12），则认为这三个点共线或几乎共线，无法形成一个平面
    // 此时将normal设置为(0, 0, 1)作为默认的法向量
    // 否则，将normal归一化，使其长度为1
    if (len < 1e-12) normal.set(0, 0, 1); else normal.divideScalar(len);
    // 计算向量u，它是从p1指向p2的向量v12在平面内的投影
    // 首先，计算v12在normal方向上的投影大小，然后从v12中减去这个投影
    // 得到的结果就是u
    let u = v12.clone().sub(normal.clone().multiplyScalar(v12.dot(normal)));
    // 如果u的长度平方小于一个很小的数（1e-12），则认为v12与normal平行或几乎平行
    // 此时将u设置为(1, 0, 0)作为默认的平面内的向量
    // 否则，将u归一化
    if (u.lengthSq() < 1e-12) u.set(1, 0, 0); else u.normalize();
    // 计算向量v，它是normal与u的叉乘结果，这样可以保证v与u垂直，并且v也垂直于normal
    // 即v也在平面内。最后，将v归一化
    const v = new THREE.Vector3().crossVectors(normal, u).normalize();
    // 返回一个包含normal, u, v的对象
    return { normal, u, v };
  }
    /**
     * 将一个3D点投影到由原点和两个正交单位向量定义的2D平面上。
     *
     * @param point - 需要投影的3D点，类型为THREE.Vector3
     * @param origin - 平面的原点，类型为THREE.Vector3
     * @param u - 平面内的第一个正交单位向量，类型为THREE.Vector3
     * @param v - 平面内的第二个正交单位向量，类型为THREE.Vector3
     * @returns 返回一个2D向量，表示点在平面内的投影坐标，类型为THREE.Vector2
     */
    to2D(point: THREE.Vector3, origin: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3) {
      // 计算从原点origin到点point的向量vec
      const vec = new THREE.Vector3().subVectors(point, origin);
      // 计算vec在u和v方向上的投影，并返回一个2D向量
      return new THREE.Vector2(vec.dot(u), vec.dot(v));
    }

}
