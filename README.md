# Claude History Manager

> 本地私有化的 Claude Code 全局控制台 - 管理你的 Mac 电脑上的 Claude Code 本地提问记录

## 项目简介

这是一个本地 B/S 架构项目，用于管理和查看 Claude Code 的本地对话历史记录。通过直观的 Web 界面，你可以浏览所有项目、查看会话列表、阅读对话详情，并查看 Claude 在后台执行的系统命令和工具调用。

## 技术栈

### 后端
- Node.js + Express
- CORS 支持
- 本地文件系统读取

### 前端
- Vue 3 + TypeScript
- Vite (构建工具)
- Element Plus (UI 组件库)
- Axios (HTTP 客户端)
- Marked (Markdown 渲染)
- Highlight.js (代码高亮)
- Vue DevTools (开发调试)

### 开发工具
- concurrently (并行运行脚本)
- npm-run-all2 (构建流程管理)
- vue-tsc (TypeScript 类型检查)

## 快速开始

### 一键启动（推荐）

```bash
# macOS / Linux
./start.sh

# 或使用 npm（会自动安装依赖）
npm run start
```

服务启动后，打开浏览器访问: http://localhost:5173/

### 手动启动

如果需要分别启动前后端：

```bash
# 1. 安装依赖
npm run install:all

# 2. 启动后端服务器 (端口 3333)
npm run start:server

# 3. 启动前端开发服务器 (端口 5173)
npm run start:client
```

### 可用命令

```bash
npm run start           # 安装依赖并一键启动
npm run start:dev       # 启动前后端（不安装依赖）
npm run start:server     # 仅启动后端
npm run start:client     # 仅启动前端
npm run install:all      # 安装前后端依赖
npm run install:server  # 仅安装后端依赖
npm run install:client  # 仅安装前端依赖
npm run build:client    # 构建前端项目
```

## 功能特性

### 核心功能
- 📁 **项目管理**: 浏览所有使用 Claude Code 的项目
- 💬 **会话历史**: 查看每个项目的所有会话记录
- 📝 **对话详情**: 类似微信聊天界面的对话流展示
- 🎨 **Markdown 渲染**: 完整支持 Markdown 格式，包括代码高亮
- 🔧 **工具调用**: 可折叠查看 Claude 在后台执行的系统命令和工具调用
- 🌙 **深色风格**: 简洁高效的后台管理系统 UI

### 统计分析
- 📊 **活动统计**: 可视化展示 Claude 使用活跃度
- 📈 **趋势图表**: 追踪会话数量和使用趋势
- 🥧 **项目分布**: 饼图展示各项目使用占比
- 📅 **贡献图**: GitHub 风格的日历热力图展示活动记录
- 🕐 **最近会话**: 快速查看最近的对话记录

## API 接口

### 获取项目列表
```
GET /api/projects
```

### 获取会话列表
```
GET /api/sessions?path=<项目路径>
```

### 获取会话详情
```
GET /api/session-detail?filePath=<会话文件路径>
```

## 项目结构

```
claude-history-manager/
├── server/                    # 后端服务
│   ├── index.js              # 主服务文件
│   ├── package.json
│   └── node_modules/
├── client/                    # 前端应用
│   ├── src/
│   │   ├── main.ts            # 入口文件
│   │   ├── App.vue           # 主应用组件
│   │   ├── env.d.ts
│   │   ├── assets/            # 静态资源
│   │   └── components/        # 组件目录
│   │       ├── ActivityStats.vue      # 活动统计组件
│   │       ├── ContributionGraph.vue  # 贡献图组件
│   │       ├── MarkdownRenderer.vue   # Markdown 渲染组件
│   │       ├── ProjectPieChart.vue    # 项目分布饼图
│   │       ├── RecentSessions.vue     # 最近会话组件
│   │       └── TrendChart.vue         # 趋势图表组件
│   ├── package.json
│   └── vite.config.ts
├── .gitignore                # Git 忽略配置
├── package.json              # 项目配置
├── start.sh                  # 一键启动脚本
└── README.md                 # 本文档
```

## 使用说明

### 基础操作
1. **选择项目**: 在左侧项目列表中点击要查看的项目
2. **查看会话**: 项目选中后，下方会显示该项目的所有会话
3. **阅读对话**: 点击会话即可查看完整的对话历史
4. **工具调用**: 如果 Claude 执行了系统命令或工具调用，会在消息下方显示可折叠的工具调用信息

### 统计分析
5. **活动统计**: 查看整体使用活跃度数据
6. **趋势分析**: 追踪会话数量变化趋势
7. **项目分布**: 了解各项目的使用占比
8. **贡献热力图**: 通过日历视图查看每日活动记录

### Node.js 版本要求
项目要求 Node.js 版本为 **^20.19.0 || >=22.12.0**

### 依赖管理
项目采用前后端分离的依赖管理方式：
- 根目录 `package.json`: 管理项目级别的脚本和开发工具
- `server/package.json`: 后端服务依赖
- `client/package.json`: 前端应用依赖

## 许可证

MIT
