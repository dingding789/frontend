import { createApp } from 'vue';
import CaeMain from './CaeMain.vue';
import { pinia } from './piniaInstance';

let appEl: HTMLElement | null = null;
let appInstance: ReturnType<typeof createApp> | null = null;

function mountCae() {
  if (!appEl) {
    appEl = document.createElement('div');
    document.body.appendChild(appEl);
  }
  if (!appInstance) {
    appInstance = createApp(CaeMain);
    appInstance.use(pinia);
    appInstance.mount(appEl);
  }
}

// 注册监听器（一次性），避免在回调中再次派发时递归触发自身
(function register() {
  const onOpenOnce = () => {
    mountCae();
    // 重新派发给 UI，但自身监听已 once，不会再次触发
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('simulation:open', { detail: { source: 'bootstrap' } }));
    }, 0);
  };
  window.addEventListener('simulation:open', onOpenOnce, { once: true });
})();

export {};