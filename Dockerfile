# 选择基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制依赖清单并安装依赖
COPY package.json ./
RUN npm install
RUN npm install three
RUN npm install vite
RUN npm install vue
# 复制项目代码
COPY . .



# 暴露端口（例如 3001）
EXPOSE 3001

# 启动命令
CMD ["npm", "run", "dev"]