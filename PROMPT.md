# "Claude 对话历史管理器" 项目提示词

## 项目概述

请帮我开发一个本地私有化的 Claude Code 全局控制台项目，用于管理我的 Mac 电脑上的 Claude Code 本地提问记录。这是一个本地 B/S 架构项目，通过直观的 Web 界面浏览所有项目、查看会话列表、阅读对话详情，并查看 Claude 在后台执行的系统命令和工具调用。

## 技术栈要求

### 后端

- Node.js + Express 框架（最新版本）
- CORS 支持
- 直接读取本地文件系统
- 监听端口：`3333`

### 前端

- Vue 3 + TypeScript（使用 Composition API）
- Vite 作为构建工具
- Element Plus UI 组件库
- Axios HTTP 客户端
- Marked 用于 Markdown 渲染
- Highlight.js 用于代码高亮

### 根项目

使用 concurrently 并行运行前后端开发服务。

## 开发步骤

### 第一步：项目结构初始化

创建如下目录结构：

```
claude-history-manager/
├── server/     # 后端服务
├── client/     # 前端应用
├── package.json # 根项目配置
├── start.sh     # 一键启动脚本
└── README.md
```

在根目录创建 `package.json`，包含以下脚本：

```json
{
  "scripts": {
    "start": "npm run install:all && npm run start:dev",
    "start:dev": "concurrently \"npm run start:server\" \"npm run start:client\"",
    "start:server": "cd server && npm start",
    "start:client": "cd client && npm run dev",
    "install:all": "npm run install:server && npm run install:client",
    "install:server": "cd server && npm install",
    "install:client": "cd client && npm install",
    "build:client": "cd client && npm run build"
  }
}
```

创建 `start.sh` 一键启动脚本，自动检查 Node.js 并安装所有依赖后启动。

---

### 第二步：后端开发

创建 `server/package.json`：

```json
{
  "dependencies": {
    "cors": "^2.8.6",
    "express": "^5.2.1"
  },
  "scripts": {
    "start": "node index.js"
  }
}
```

创建 `server/index.js`，实现以下 6 个 API 端点：

1. **`GET /api/projects`** - 获取所有项目列表
   - 从 `~/.claude.json` 读取项目配置
   - 将 `projects` 对象转换为数组，包含 `path`、`name`、`lastSessionId` 字段
   - 返回格式：`{ success: true, projects: [...] }`

2. **`GET /api/sessions?path=<项目路径>`** - 获取指定项目的会话列表
   - 从 `~/.claude/projects/` 读取会话文件
   - 使用 `lastSessionId` 匹配项目目录（最可靠，支持中文项目名）
   - 回退：通过路径最后一段名称匹配
   - 过滤出 `.jsonl` 文件（排除 settings 文件）
   - 按修改时间倒序排列
   - 返回：`{ success: true, sessions: [...] }`，每个会话包含 `id`、`filename`、`path`、`modifiedAt`

3. **`GET /api/session-detail?filePath=<会话文件路径>`** - 获取会话详情
   - 读取 JSONL 文件，每行一个 JSON 对象
   - 解析消息，提取 `user` 和 `assistant` 角色的消息
   - 处理两种格式：`data.content` 和嵌套 `data.message.content`
   - 提取工具调用信息 `toolCalls`
   - 返回：`{ success: true, sessionId: "...", messages: [...] }`
   - 每个消息格式：`{ role, content, toolCalls }`

4. **`GET /api/search?q=<关键词>`** - 全局搜索对话内容
   - 遍历所有项目所有会话
   - 在消息内容中搜索关键词
   - 返回匹配结果，包含上下文预览
   - 限制最多返回 50 条结果

5. **`GET /api/stats`** - 获取统计信息
   - 统计总项目数、总会话数
   - 项目会话数量排名（Top 10）
   - 生成贡献热力图数据（按日期统计）
   - 获取最近访问的 10 个会话
   - 返回：`{ success: true, stats: { totalProjects, totalSessions, projectStats, contributionGraph, recentSessions } }`

6. **`GET /api/security/scan`** - 扫描敏感信息
   - 扫描所有对话内容中的敏感信息：
     - API Key（`sk-` 开头）
     - Token
     - Password
     - Email
     - IP Address
     - JWT
   - 按严重程度（`high/medium/low`）排序
   - 返回扫描结果，限制最多 100 条

后端启动监听端口 `3333`，启用 CORS 中间件。

---

### 第三步：前端开发

#### 初始化项目

使用 `npm create vite@latest client -- --template vue-ts` 创建项目，安装依赖。

`client/package.json` 需要包含：

```json
"dependencies": {
  "axios": "^1.13.6",
  "element-plus": "^2.13.5",
  "highlight.js": "^11.11.1",
  "marked": "^17.0.4",
  "vue": "^3.5.29"
}
```

要求 Node.js 版本：`^20.19.0 || >=22.12.0`

#### 入口配置 (`client/src/main.ts`)

- 引入 Element Plus 及其样式
- 引入主 CSS 文件

#### 创建以下组件 (`client/src/components/`)

1. **`ActivityStats.vue`** - 活动统计卡片组件
   - 显示总项目数、总会话数
   - 使用 Element Plus Card 组件展示

2. **`ContributionGraph.vue`** - GitHub 风格贡献日历热力图
   - 按日期显示活动强度
   - 格子颜色深浅对应当天会话数量

3. **`MarkdownRenderer.vue`** - Markdown 渲染组件
   - 使用 marked 渲染 Markdown
   - 使用 highlight.js 对代码块进行语法高亮
   - 支持可折叠的工具调用信息展示

4. **`ProjectPieChart.vue`** - 项目分布饼图
   - 展示会话数最多的前 10 个项目占比
   - 使用 Canvas 绘制饼图

5. **`RecentSessions.vue`** - 最近会话列表组件
   - 显示最近修改的 10 个会话
   - 支持点击跳转查看

6. **`TrendChart.vue`** - 趋势折线图
   - 按日期展示会话数量变化趋势

#### 主应用 (`client/src/App.vue`)

整体布局采用三栏布局：

- **左侧边栏**：项目列表 + 统计区域
  - 项目列表可点击选择
  - 下方显示最近会话和统计组件

- **中栏**：会话列表（选中项目后显示）
  - 按时间倒序排列
  - 显示修改时间

- **右侧主区域**：对话详情展示
  - 类微信聊天界面，用户消息在右，助手消息在左
  - Markdown 完整渲染，代码高亮
  - 工具调用可折叠查看

#### 功能特性：

- 全局搜索：快捷键 `Cmd+K` 唤起搜索框
- 快捷键支持：`Esc` 关闭弹窗，`1/2/3` 切换视图，`↑/↓` 导航
- 深色风格主题，简洁高效
- 点击会话加载对话详情
- 支持复制内容到剪贴板

#### 标签页/视图切换：

1. **仪表盘** - 显示统计图表
2. **项目浏览** - 浏览项目和会话
3. **全局搜索** - 搜索结果展示

---

### 第四步：核心功能细节

#### Claude Code 数据文件位置

- 配置文件：`~/.claude.json` - 包含所有项目信息和 `lastSessionId`
- 会话存储：`~/.claude/projects/` - 每个项目一个目录，存放 `.jsonl` 会话文件

#### 项目目录匹配逻辑

1. 优先使用 `lastSessionId` 匹配：查找哪个目录下包含该会话ID的 jsonl 文件
2. 回退策略：通过项目路径的最后一个目录名模糊匹配

#### JSONL 解析处理

- 逐行解析，跳过解析失败的坏行
- 支持多种消息格式（Claude Code 不同时期的存储格式）
- 正确提取工具调用信息

---

### 第五步：启动和构建

- 开发：前后端同时启动，前端 `http://localhost:5173`，后端 `http://localhost:3333`
- 构建：执行 `npm run build:client` 生成前端生产构建产物

---

## UI 设计要求

- 深色背景主题，适合开发者长时间查看
- 三栏布局清晰，**项目 → 会话 → 详情** 层级明确
- 对话流采用类聊天软件布局，易于阅读
- 代码块正确高亮显示
- 工具调用信息默认折叠，需要时展开查看

---

## 完成检查

请确保：

1. 所有 API 都正确实现并处理错误
2. 前端能够正确读取并显示所有数据
3. 项目能够通过 `./start.sh` 一键启动
4. TypeScript 类型检查通过
5. 敏感信息扫描功能正常工作
6. 全局搜索功能可用

---

现在请按照上述步骤帮我从零开始完整开发这个项目！
