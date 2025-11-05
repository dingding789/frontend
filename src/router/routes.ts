// 统一管理后端接口路径
// TODO: 将下面这些路径改成你 C++ 后端的实际路由

declare const API_BASE: string

export const routes = {
  lines: {
    list: `${API_BASE}/lines`,
    add: `${API_BASE}/lines`,
    item: (id: number | string) => `${API_BASE}/lines/${id}`,
  },
  sketch: {
    save: `${API_BASE}/sketch/save`,
    list: `${API_BASE}/sketch/list`,
    load: (id: number | string) => `${API_BASE}/sketch/load?id=${id}`,
    delete: (id: number | string) => `${API_BASE}/sketch/delete?id=${id}`,
  },
  mesh: `${API_BASE}/mesh`, // 可选接口
}

export type HttpMethod = 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH'
