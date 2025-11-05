# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).



安装NPM
https://blog.csdn.net/weixin_62818371/article/details/146175470


第一次运行时，需要在终端先安装依赖，创建数据库：
npm install
npm install three
npm install vite
npm install vue
mysql -u root -p
输入密码：123456
source mysql/init.sql

在终端运行：
npm run dev



geometry-service-frontend/
│
├─ package.json                # 项目依赖与脚本配置
├─ vite.config.ts              # Vite 构建工具配置
├─ tsconfig.app.json           # TypeScript 应用配置
├─ README.md                   # 项目说明文档
├─ Dockerfile                  # Docker 部署配置
├─ index.html                  # 应用入口 HTML
├─ shims-vue.d.ts              # Vue 类型声明
│
├─ public/
│
├─ src/
│   ├─ main.ts                 # Vue 应用入口
│   ├─ App.vue                 # 根组件
│   ├─ assets/                 # 静态资源（图片、样式等）
│   │   ├─ style.css
│   │   └─ vue.svg
│   ├─ core/                   # 几何与渲染核心逻辑
│   │   ├─ constants/          # 常量配置（颜色、图层等）
│   │   ├─ geometry/           # 几何数据与算法
│   │   │   ├─ constraints/    # 几何约束相关
│   │   │   ├─ features/       # 特征建模（拉伸、旋转等）
│   │   │   ├─ operations/     # 几何运算（布尔、变换等）
│   │   │   ├─ sketchs/        # 草图相关
│   │   │   └─ solids/         # 三维实体结构
│   │   ├─ managers/           # 业务管理器
│   │   │   ├─ constraintManager/
│   │   │   ├─ eventManager/
│   │   │   ├─ featureManager/
│   │   │   ├─ selectionManager/
│   │   │   ├─ sketchManager/
│   │   │   ├─ solidManager/
│   │   │   └─ undoRedoManager/
│   │   ├─ scene/              # Three.js 场景相关
│   │   │   ├─ AppManager.ts
│   │   │   ├─ SceneCamera.ts
│   │   │   ├─ SceneControls.ts
│   │   │   ├─ SceneLights.ts
│   │   │   ├─ SceneManager.ts
│   │   │   └─ SceneRenderer.ts
│   │   └─ utils/              # 工具函数
│   │       ├─ ColorUtils.ts
│   │       ├─ GeometryUtils.ts
│   │       ├─ MathUtils.ts
│   │       ├─ ObjectUtils.ts
│   │       ├─ SceneUtils.ts
│   │       └─ sketchUtils.ts
│   ├─ domain/                 # 领域模型与服务
│   │   ├─ factories/          # 工厂类
│   │   ├─ models/             # 数据模型
│   │   ├─ services/           # 业务服务
│   │   └─ tools/              # 领域工具
│   ├─ infrastructure/         # 通信、存储、调度
│   │   ├─ api/                # 后端接口
│   │   ├─ storage/            # 本地存储与快照
│   │   └─ workers/            # WebWorker 并行计算
│   ├─ router/                 # 路由配置
│   │   └─ routes.ts
│   ├─ store/                  # Pinia 状态管理
│   │   ├─ useFeatureStore.ts
│   │   ├─ useSceneStore.ts
│   │   ├─ useSelectionStore.ts
│   │   ├─ useSketchStore.ts
│   │   ├─ useSolidStore.ts
│   │   └─ useUIStore.ts
│   ├─ ui/                     # 前端 UI 组件
│   │   ├─ dialogs/            # 弹窗对话框
│   │   ├─ layout/             # 布局相关组件
│   │   ├─ panels/             # 侧边/属性面板
│   │   ├─ toolbar/            # 工具栏
│   │   └─ viewport/           # Three.js 视口及覆盖层
│   ├─ utils/                  # 通用工具函数
│   │   ├─ debounce.ts
│   │   ├─ eventBus.ts
│   │   ├─ logger.ts
│   │   ├─ throttle.ts
│   │   └─ uuid.ts
│   ├─ views/                  # 页面视图（路由页面）
│   │   ├─ HomeView.vue        # 首页
│   │   ├─ SketchView.vue      # 草图页面
│   │   ├─ FeatureView.vue     # 特征建模页面
│   │   ├─ SolidView.vue       # 实体页面
│   │   └─ ProjectView.vue     # 项目管理页面
│
└─ tests/                      # 单元测试



