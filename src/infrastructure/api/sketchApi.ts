// Sketch API
import { routes } from '../../router/routes';
export async function saveSketch(data: any) {
  return fetch(routes.sketch.save, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof data === 'string' ? data : JSON.stringify(data),
  });
}

export async function updateSketch(data: any) {
  //返回草图编辑路由
  return fetch(routes.sketch.edit, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof data === 'string' ? data : JSON.stringify(data),
  });
}

export async function loadSketch(id: number) {
  return fetch(routes.sketch.load(id));
}

export async function listSketches() {
  return fetch(routes.sketch.list);
}

export async function deleteSketch(id: number) {
  return fetch(routes.sketch.delete(id), { method: 'DELETE' });
}