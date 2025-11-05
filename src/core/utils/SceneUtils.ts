// SceneUtils.ts
import * as THREE from 'three';

/** 清空场景中的所有对象（不包括灯光和相机） */
export function clearSceneObjects(scene: THREE.Scene) {
  scene.children
    .filter(obj => !(obj instanceof THREE.Light) && !(obj instanceof THREE.Camera))
    .forEach(obj => scene.remove(obj));
}

/** 获取场景中所有指定类型的对象 */
export function getObjectsByType(scene: THREE.Scene, type: string): THREE.Object3D[] {
  return scene.children.filter(obj => obj.type === type);
}

/** 添加辅助网格到场景 */
export function addGridHelper(scene: THREE.Scene, size = 100, divisions = 10) {
  const grid = new THREE.GridHelper(size, divisions);
  scene.add(grid);
  return grid;
}

// 更多场景相关工具可按需扩展// SceneUtils