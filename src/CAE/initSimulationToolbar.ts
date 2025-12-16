import { createApp } from 'vue';
import SimulationToolbar from './SimulationToolbar.vue';

// 工具栏容器元素与应用实例
let appEl: HTMLElement | null = null;
let appInstance: ReturnType<typeof createApp> | null = null;

// 挂载工具栏到页面（首次需要创建容器）
function mountToolbar() {
  if (!appEl) {
    appEl = document.createElement('div');
    document.body.appendChild(appEl);
  }
  if (!appInstance) {
    appInstance = createApp(SimulationToolbar);
    appInstance.mount(appEl);
  }
}

// 卸载工具栏（如需彻底移除）
function unmountToolbar() {
  if (appInstance && appEl) {
    appInstance.unmount();
    appInstance = null;
  }
  if (appEl) {
    appEl.remove();
    appEl = null;
  }
}

// 当本模块被导入时，自动注册仿真事件监听
(function register() {
  // 首次打开仿真时再挂载工具栏，避免提前加载 UI
  const onOpen = () => {
    mountToolbar();
    // 转发事件，通知工具栏自身显示
    window.dispatchEvent(new CustomEvent('simulation:open'));
  };
  const onClose = () => {
    // 转发事件，通知工具栏自身隐藏（保持已挂载状态）
    window.dispatchEvent(new CustomEvent('simulation:close'));
  };

  window.addEventListener('simulation:open', onOpen);
  window.addEventListener('simulation:close', onClose);
})();

// 导出空对象，保持模块语义
export {};