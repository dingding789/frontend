// 全局 wasm 单例初始化
import MainModuleFactory, { MainModule } from './chili-wasm';

let wasmInstance: MainModule | null = null;
let loadPromise: Promise<MainModule> | null = null;

export function ensureWasm(): Promise<MainModule> {
  if (wasmInstance) return Promise.resolve(wasmInstance);
  if (loadPromise) return loadPromise;
  loadPromise = MainModuleFactory()
    .then(m => {
      wasmInstance = m;
      return m;
    })
    .catch(e => {
      console.error('wasm 全局加载失败:', e);
      loadPromise = null;
      throw e;
    });
  return loadPromise;
}

export function getWasm(): MainModule | null {
  return wasmInstance;
}
