<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { ElMessage, ElDialog, ElInput } from "element-plus";
import MarkdownRenderer from "./components/MarkdownRenderer.vue";
import ContributionGraph from "./components/ContributionGraph.vue";
import ProjectPieChart from "./components/ProjectPieChart.vue";
import RecentSessions from "./components/RecentSessions.vue";
import TrendChart from "./components/TrendChart.vue";
import ActivityStats from "./components/ActivityStats.vue";

// API 基础 URL
const API_BASE = "http://localhost:3333/api";

// 复制到剪贴板
const copyToClipboard = async (text: string, label?: string) => {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success({
      message: label ? `${label} 已复制` : "已复制",
      duration: 1500,
      plain: true,
    });
  } catch (err) {
    ElMessage.error("复制失败");
  }
};

// 全局搜索相关
const searchDialogVisible = ref(false);
const searchQuery = ref("");
const searchResults = ref<any[]>([]);
const searching = ref(false);
const selectedSearchResult = ref<any>(null);
const previewLoading = ref(false);
const previewMessages = ref<Message[]>([]);
const shortcutsHelpVisible = ref(false);

// 快捷键列表
const shortcuts = [
  { key: "⌘ K", description: "全局搜索", action: "唤起搜索框" },
  { key: "Esc", description: "关闭弹窗", action: "关闭当前打开的对话框" },
  {
    key: "1/2/3",
    description: "切换视图",
    action: "1=仪表盘 2=项目浏览 3=全局搜索",
  },
  { key: "↑/↓", description: "导航", action: "在列表中上下移动" },
  { key: "Enter", description: "确认", action: "选中当前项" },
];

// 执行搜索
const performSearch = async () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }

  searching.value = true;
  try {
    const response = await fetch(
      `${API_BASE}/search?q=${encodeURIComponent(searchQuery.value)}`,
    );
    const data = await response.json();
    if (data.success) {
      searchResults.value = data.results;
    }
  } catch (error) {
    console.error("搜索失败:", error);
  } finally {
    searching.value = false;
  }
};

// 选择搜索结果
const selectSearchResult = (result: any, jumpToView = false) => {
  selectedSearchResult.value = result;

  if (jumpToView) {
    // 跳转到项目和会话详情视图
    const project = projects.value.find((p) => p.path === result.projectPath);
    if (project) {
      currentView.value = "projects";
      handleSelectProject(project);
      // 延迟获取会话列表后再选中会话
      setTimeout(() => {
        const session = sessions.value.find((s) => s.id === result.sessionId);
        if (session) {
          handleSelectSession(session);
        }
      }, 100);
    }
    searchDialogVisible.value = false;
  } else {
    // 在预览窗格中显示
    loadPreviewMessages(result);
  }
};

// 加载预览消息
const loadPreviewMessages = async (result: any) => {
  previewLoading.value = true;
  previewMessages.value = [];
  try {
    const response = await fetch(
      `${API_BASE}/session-detail?filePath=${encodeURIComponent(result.sessionPath)}`,
    );
    const data = await response.json();
    if (data.success) {
      previewMessages.value = data.messages;
    }
  } catch (error) {
    console.error("加载预览失败:", error);
  } finally {
    previewLoading.value = false;
  }
};

// 快捷键监听
const handleKeydown = (e: KeyboardEvent) => {
  // Cmd/Ctrl + K 唤起搜索
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    searchDialogVisible.value = true;
    searchQuery.value = "";
    searchResults.value = [];
    setTimeout(() => {
      const input = document.querySelector(
        ".search-input input",
      ) as HTMLInputElement;
      input?.focus();
    }, 100);
  }
  // ? 唤起快捷键帮助
  if (e.key === "?" && !searchDialogVisible.value) {
    e.preventDefault();
    shortcutsHelpVisible.value = true;
  }
  // 数字键切换视图
  if (["1", "2", "3"].includes(e.key) && !e.metaKey && !e.ctrlKey) {
    const viewMap: Record<string, ViewType> = {
      "1": "dashboard",
      "2": "projects",
      "3": "search",
    };
    const newView = viewMap[e.key];
    if (newView) {
      currentView.value = newView;
    }
  }
  // ESC 关闭弹窗
  if (e.key === "Escape") {
    if (searchDialogVisible.value) {
      searchDialogVisible.value = false;
    }
    if (shortcutsHelpVisible.value) {
      shortcutsHelpVisible.value = false;
    }
  }
};

// 数据类型定义
interface Project {
  path: string;
  name: string;
  lastSessionId: string | null;
}

interface Session {
  id: string;
  filename: string;
  path: string;
  modifiedAt: Date;
}

interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls: ToolCall[];
}

// 响应式状态
const projects = ref<Project[]>([]);
const sessions = ref<Session[]>([]);
const messages = ref<Message[]>([]);
const selectedProject = ref<Project | null>(null);
const selectedSession = ref<Session | null>(null);
const loadingProjects = ref(false);
const loadingSessions = ref(false);
const loadingMessages = ref(false);
const sessionTitles = ref<Record<string, string>>({});

// 视图类型
type ViewType = "dashboard" | "projects" | "search";
const currentView = ref<ViewType>("projects");

// 导航菜单项
const navItems = [
  { key: "dashboard" as ViewType, label: "仪表盘", icon: "📊" },
  { key: "projects" as ViewType, label: "项目浏览", icon: "📁" },
  { key: "search" as ViewType, label: "全局搜索", icon: "🔍" },
  // { key: 'security' as ViewType, label: '安全清理', icon: '🔒' }
];

// 统计数据
const stats = ref<any>(null);
const loadingStats = ref(false);

const fetchStats = async () => {
  loadingStats.value = true;
  try {
    const response = await fetch(`${API_BASE}/stats`);
    const data = await response.json();
    if (data.success) {
      stats.value = data.stats;
    }
  } catch (error) {
    console.error("获取统计失败:", error);
  } finally {
    loadingStats.value = false;
  }
};

// 获取项目列表
const fetchProjects = async () => {
  loadingProjects.value = true;
  try {
    const response = await fetch(`${API_BASE}/projects`);
    const data = await response.json();
    if (data.success) {
      projects.value = data.projects;
    }
  } catch (error) {
    console.error("获取项目列表失败:", error);
  } finally {
    loadingProjects.value = false;
  }
};

// 获取会话列表
const fetchSessions = async (projectPath: string) => {
  loadingSessions.value = true;
  try {
    const response = await fetch(
      `${API_BASE}/sessions?path=${encodeURIComponent(projectPath)}`,
    );
    const data = await response.json();
    if (data.success) {
      sessions.value = data.sessions;
    }
  } catch (error) {
    console.error("获取会话列表失败:", error);
  } finally {
    loadingSessions.value = false;
  }
};

// 获取会话详情
const fetchSessionDetail = async (filePath: string) => {
  loadingMessages.value = true;
  try {
    const response = await fetch(
      `${API_BASE}/session-detail?filePath=${encodeURIComponent(filePath)}`,
    );
    const data = await response.json();
    if (data.success) {
      messages.value = data.messages;
      // 自动生成会话标题
      if (
        selectedSession.value &&
        !sessionTitles.value[selectedSession.value.id]
      ) {
        sessionTitles.value[selectedSession.value.id] = generateSessionTitle(
          data.messages,
        );
      }
    }
  } catch (error) {
    console.error("获取会话详情失败:", error);
  } finally {
    loadingMessages.value = false;
  }
};

// 智能生成会话标题
const generateSessionTitle = (messages: Message[]): string => {
  if (!messages || messages.length === 0) {
    return "新对话";
  }

  // 获取前几条用户消息
  const userMessages = messages.filter((m) => m.role === "user").slice(0, 2);
  const firstUserMessage = userMessages[0]?.content || "";

  // 提取关键信息生成标题
  let title = "";

  // 尝试识别常见任务类型
  const taskPatterns = [
    { pattern: /创建|新建|添加|generate|create/i, prefix: "创建" },
    { pattern: /修复|解决|fix|solve|debug/i, prefix: "修复" },
    { pattern: /优化|改进|improve|optimize/i, prefix: "优化" },
    { pattern: /实现|完成|implement|complete/i, prefix: "实现" },
    { pattern: /删除|移除|delete|remove/i, prefix: "删除" },
    { pattern: /更新|修改|修改|update|modify|change/i, prefix: "更新" },
    { pattern: /搜索|查找|search|find/i, prefix: "搜索" },
    { pattern: /分析|了解|analyze|understand/i, prefix: "分析" },
  ];

  for (const { pattern, prefix } of taskPatterns) {
    if (pattern.test(firstUserMessage)) {
      title = prefix;
      break;
    }
  }

  // 提取关键词
  const cleanText = firstUserMessage
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, " ")
    .trim()
    .substring(0, 50);

  const keywords = cleanText.split(/\s+/).filter((w) => w.length > 1);

  // 组合标题
  if (!title) {
    title = keywords[0] || "对话";
  } else if (keywords.length > 0) {
    const keyword = keywords.find((k) => k.length <= 8) || keywords[0];
    title += " " + keyword;
  }

  // 限制长度
  if (title.length > 20) {
    title = title.substring(0, 20) + "...";
  }

  return title || "新对话";
};

// 获取会话标题
const getSessionTitle = (sessionId: string): string => {
  return sessionTitles.value[sessionId] || sessionId.slice(0, 8);
};

// 选择项目
const handleSelectProject = (project: Project) => {
  selectedProject.value = project;
  selectedSession.value = null;
  messages.value = [];
  fetchSessions(project.path);
};

// 选择会话
const handleSelectSession = (session: Session) => {
  selectedSession.value = session;
  fetchSessionDetail(session.path);
};

// 处理最近会话点击
const handleRecentSessionClick = (sessionData: any) => {
  // 切换到项目视图
  currentView.value = "projects";

  // 查找并选择项目
  const project = projects.value.find(
    (p) => p.path === sessionData.projectPath,
  );
  if (project) {
    handleSelectProject(project);

    // 延迟获取会话列表后再选中会话
    setTimeout(() => {
      const session = sessions.value.find(
        (s) => s.id === sessionData.sessionId,
      );
      if (session) {
        handleSelectSession(session);
      }
    }, 100);
  }
};

// 格式化时间
const formatDate = (date: Date) => {
  const d = new Date(date);
  return d.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// 高亮搜索关键词
const highlightSearchTerm = (text: string, term: string) => {
  if (!term || !text) return text;
  const regex = new RegExp(
    `(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
};

// 组件挂载时获取项目列表
onMounted(() => {
  fetchProjects();
  fetchStats();
  // 添加键盘事件监听
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <div class="app-container">
    <!-- 全局搜索弹窗 -->
    <ElDialog
      v-model="searchDialogVisible"
      title="全局搜索"
      width="600px"
      class="search-dialog"
      :show-close="true"
      @close="
        () => {
          searchQuery = '';
          searchResults = [];
        }
      "
    >
      <ElInput
        v-model="searchQuery"
        placeholder="搜索对话内容... (Cmd+K)"
        class="search-input"
        clearable
        @input="performSearch"
      >
        <template #prefix>
          <span>🔍</span>
        </template>
      </ElInput>

      <div class="search-results">
        <div v-if="searching" class="search-loading">搜索中...</div>
        <div
          v-else-if="searchResults.length === 0 && searchQuery"
          class="search-empty"
        >
          未找到匹配结果
        </div>
        <div v-else-if="!searchQuery" class="search-hint">
          输入关键词开始搜索，支持跨所有项目的对话内容
        </div>
        <div v-else class="search-list">
          <div
            v-for="(result, index) in searchResults"
            :key="index"
            class="search-result-item"
            @click="selectSearchResult(result)"
          >
            <div class="search-result-header">
              <span class="search-project">{{ result.projectName }}</span>
              <span class="search-session">{{
                result.sessionId.slice(0, 8)
              }}</span>
            </div>
            <div class="search-preview">{{ result.preview }}</div>
          </div>
        </div>
      </div>
    </ElDialog>

    <!-- 快捷键帮助弹窗 -->
    <ElDialog
      v-model="shortcutsHelpVisible"
      title="快捷键帮助"
      width="500px"
      class="shortcuts-dialog"
      :show-close="true"
    >
      <div class="shortcuts-list">
        <div
          v-for="(shortcut, index) in shortcuts"
          :key="index"
          class="shortcut-item"
        >
          <div class="shortcut-key">
            <kbd>{{ shortcut.key }}</kbd>
          </div>
          <div class="shortcut-info">
            <div class="shortcut-desc">{{ shortcut.description }}</div>
            <div class="shortcut-action">{{ shortcut.action }}</div>
          </div>
        </div>
      </div>
      <div class="shortcuts-footer">
        <p>按 <kbd>?</kbd> 或 <kbd>Esc</kbd> 关闭</p>
      </div>
    </ElDialog>

    <div class="app-layout">
      <!-- 左侧图标导航栏 -->
      <nav class="nav-bar">
        <div class="logo">极简</div>
        <button
          v-for="item in navItems"
          :key="item.key"
          class="nav-btn"
          :class="{ active: currentView === item.key }"
          :data-nav="item.key"
          :title="item.label"
          @click="currentView = item.key"
        >
          <svg
            v-if="item.key === 'dashboard'"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
          <svg
            v-else-if="item.key === 'projects'"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <path
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
            />
          </svg>
          <svg
            v-else-if="item.key === 'search'"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
      </nav>

      <!-- 主内容区 -->
      <div class="main-content">
        <!-- 项目列表面板 -->
        <aside v-if="currentView === 'projects'" class="project-panel">
          <div class="panel-title">
            <span>项目列表</span>
            <span class="badge">{{ projects.length }}</span>
          </div>
          <div v-if="loadingProjects" class="loading">加载中...</div>
          <div v-else-if="projects.length === 0" class="empty-text">
            暂无项目
          </div>
          <div v-else class="panel-list">
            <div
              v-for="project in projects"
              :key="project.path"
              class="project-item"
              :class="{ active: selectedProject?.path === project.path }"
              :data-project="project.path"
              @click="handleSelectProject(project)"
            >
              <span class="project-name">{{ project.name }}</span>
              <svg
                v-if="selectedProject?.path === project.path"
                class="chevron"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </div>
        </aside>

        <!-- 会话列表面板 -->
        <aside v-if="currentView === 'projects'" class="conv-panel">
          <div class="panel-title">
            <span>会话列表</span>
            <span class="badge">{{ sessions.length }}</span>
          </div>
          <div v-if="loadingSessions" class="loading">加载中...</div>
          <div v-else-if="!selectedProject" class="empty-text">
            请先选择项目
          </div>
          <div v-else-if="sessions.length === 0" class="empty-text">
            暂无会话
          </div>
          <div v-else class="panel-list">
            <div
              v-for="session in sessions"
              :key="session.id"
              class="conv-item"
              :class="{ active: selectedSession?.id === session.id }"
              :data-conv="session.id"
              @click="handleSelectSession(session)"
            >
              <div class="conv-title">{{ getSessionTitle(session.id) }}</div>
              <div class="conv-meta">
                <span class="conv-hash" :title="session.id">{{
                  session.id.slice(0, 8)
                }}</span>
                <span class="conv-time">{{
                  formatDate(session.modifiedAt)
                }}</span>
              </div>
            </div>
          </div>
        </aside>

        <!-- 搜索列表面板 -->
        <aside v-if="currentView === 'search'" class="search-panel">
          <div class="panel-title">全局搜索</div>
          <div class="search-view-content">
            <ElInput
              v-model="searchQuery"
              placeholder="搜索所有项目的对话内容..."
              size="large"
              class="search-view-input"
              clearable
              @input="performSearch"
            >
              <template #prefix>
                <span>🔍</span>
              </template>
            </ElInput>
            <div class="search-results-list">
              <div v-if="searching" class="search-loading">搜索中...</div>
              <div
                v-else-if="searchResults.length === 0 && searchQuery"
                class="search-empty"
              >
                未找到匹配结果
              </div>
              <div v-else-if="!searchQuery" class="search-hint">
                输入关键词开始搜索，支持跨所有项目的对话内容
              </div>
              <div v-else class="search-result-items">
                <div
                  v-for="(result, index) in searchResults"
                  :key="index"
                  class="search-result-item"
                  :class="{
                    selected:
                      selectedSearchResult?.sessionPath === result.sessionPath,
                  }"
                  @click="selectSearchResult(result, false)"
                  @dblclick="selectSearchResult(result, true)"
                >
                  <div class="search-result-header">
                    <span class="search-project">{{ result.projectName }}</span>
                    <span class="search-session-id" :title="result.sessionId">{{
                      result.sessionId.slice(0, 8)
                    }}</span>
                  </div>
                  <div
                    class="search-preview"
                    v-html="highlightSearchTerm(result.preview, searchQuery)"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <!-- 右侧主内容区 -->
        <main class="main-pane">
          <!-- 仪表盘视图 -->
          <div v-if="currentView === 'dashboard'" class="dashboard-main">
            <div v-if="loadingStats" class="dashboard-loading">
              加载统计中...
            </div>
            <div v-else-if="stats" class="dashboard-main-content">
              <!-- 活动统计 -->
              <ActivityStats :data="stats.contributionGraph || []" />

              <!-- 对话趋势图 -->
              <TrendChart
                :data="stats.contributionGraph || []"
                title="对话趋势"
              />

              <!-- GitHub 风格热力图 -->
              <ContributionGraph :data="stats.contributionGraph || []" />

              <!-- 项目分布饼图 -->
              <div class="dashboard-chart-section">
                <ProjectPieChart :data="stats.projectStats || []" />
              </div>

              <!-- 最近访问的会话 -->
              <RecentSessions
                v-if="stats.recentSessions && stats.recentSessions.length > 0"
                :data="stats.recentSessions"
                @click="handleRecentSessionClick"
              />
            </div>
            <div v-else class="dashboard-empty">
              <div class="empty-icon">📊</div>
              <p>暂无统计数据</p>
            </div>
          </div>

          <!-- 搜索预览窗格 -->
          <div
            v-if="currentView === 'search' && selectedSearchResult"
            class="preview-pane"
          >
            <div class="preview-header">
              <div class="preview-info">
                <span class="preview-project">{{
                  selectedSearchResult.projectName
                }}</span>
                <span
                  class="preview-session"
                  :title="selectedSearchResult.sessionId"
                >
                  {{ selectedSearchResult.sessionId.slice(0, 12) }}
                </span>
              </div>
              <button
                class="preview-jump-btn"
                @click="selectSearchResult(selectedSearchResult, true)"
              >
                在完整视图中打开 →
              </button>
            </div>

            <div v-if="previewLoading" class="preview-loading">加载中...</div>
            <div v-else-if="previewMessages.length === 0" class="preview-empty">
              <div class="empty-icon">📭</div>
              <p>暂无对话内容</p>
            </div>
            <div v-else class="preview-messages">
              <div
                v-for="(message, index) in previewMessages"
                :key="index"
                class="preview-message"
                :class="message.role"
              >
                <div class="preview-message-role">
                  {{ message.role === "user" ? "You" : "Claude" }}
                </div>
                <div class="preview-message-content">
                  <MarkdownRenderer :content="message.content" />
                </div>
              </div>
            </div>
          </div>

          <!-- 搜索欢迎页 -->
          <div
            v-if="currentView === 'search' && !selectedSearchResult"
            class="welcome-screen"
          >
            <div class="welcome-icon">🔍</div>
            <h1 class="welcome-title">全局搜索</h1>
            <p class="welcome-subtitle">在左侧输入关键词搜索对话</p>
            <p class="welcome-hint">单击搜索结果预览，双击跳转到完整视图</p>
          </div>

          <!-- 欢迎页 -->
          <div
            v-if="!selectedSession && currentView === 'projects'"
            class="welcome-screen"
          >
            <div class="welcome-icon">💬</div>
            <h1 class="welcome-title">Claude 历史记录管理器</h1>
            <p class="welcome-subtitle">请从左侧选择项目和会话来查看对话详情</p>
            <div class="shortcut-hint">
              <span class="hint-icon">⌘</span>
              <span class="hint-key">K</span>
              <span class="hint-text">全局搜索</span>
            </div>
          </div>

          <!-- 对话详情 -->
          <div
            v-if="selectedSession && currentView === 'projects'"
            class="chat-view"
          >
            <div class="chat-header">
              <div class="chat-info">
                <span class="chat-project">{{ selectedProject?.name }}</span>
                <span class="chat-session">{{
                  selectedSession?.id.slice(0, 12)
                }}</span>
              </div>
            </div>

            <div v-if="loadingMessages" class="loading">加载对话中...</div>
            <div v-else-if="messages.length === 0" class="empty-messages">
              <div class="empty-icon">📭</div>
              <p>暂无对话内容</p>
            </div>
            <div v-else class="messages-wrapper">
              <!-- 时间轴 -->
              <div class="timeline"></div>

              <div class="messages">
                <div
                  v-for="(message, index) in messages"
                  :key="index"
                  class="message"
                  :class="message.role"
                >
                  <div class="message-timeline-point"></div>
                  <div class="message-content">
                    <div class="message-header">
                      <span class="message-role">
                        {{ message.role === "user" ? "You" : "Claude" }}
                      </span>
                      <span class="message-index">#{{ index + 1 }}</span>
                    </div>
                    <div class="message-body">
                      <MarkdownRenderer :content="message.content" />
                    </div>
                    <!-- 工具调用折叠面板 -->
                    <div
                      v-if="message.toolCalls && message.toolCalls.length > 0"
                      class="tool-calls-terminal"
                    >
                      <details class="terminal-panel">
                        <summary class="terminal-header">
                          <span class="terminal-prompt">$</span>
                          <span class="terminal-text">工具调用</span>
                          <span class="terminal-badge">{{
                            message.toolCalls.length
                          }}</span>
                        </summary>
                        <div class="terminal-body">
                          <div
                            v-for="(toolCall, toolIndex) in message.toolCalls"
                            :key="toolIndex"
                            class="terminal-command"
                          >
                            <div class="command-header">
                              <span class="command-prompt">➜</span>
                              <code class="command-name">{{
                                toolCall.function.name
                              }}</code>
                              <button
                                v-if="toolCall.function.name === 'Bash'"
                                class="copy-command-btn"
                                @click="
                                  copyToClipboard(
                                    toolCall.function.arguments,
                                    '命令',
                                  )
                                "
                                title="复制命令"
                              >
                                复制
                              </button>
                            </div>
                            <pre class="command-args">{{
                              toolCall.function.arguments
                            }}</pre>
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 应用布局 - Futuristic Cyberpunk */
.app-layout {
  display: flex;
  flex-direction: row;
  height: 100vh;
  width: 100vw;
  background: var(--bg-primary);
  font-family: var(--font-sans);
  color: var(--text-primary);
  font-size: 13px;
  overflow: hidden;
  position: relative;
}

/* Scan line effect */
.app-layout::before {
  content: "";
  position: fixed;
  top: -100%;
  left: 0;
  width: 100%;
  height: 4px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--accent-color),
    transparent
  );
  opacity: 0.5;
  animation: scanLine 8s linear infinite;
  pointer-events: none;
  z-index: 1000;
}

/* 左侧图标导航栏 */
.nav-bar {
  width: 56px;
  background: var(--bg-tertiary);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 12px;
  border-right: 1px solid var(--border-color);
  flex-shrink: 0;
  gap: 4px;
  position: relative;
}

.nav-bar::after {
  content: "";
  position: absolute;
  bottom: 0;
  right: 0;
  width: 2px;
  height: 100%;
  background: linear-gradient(
    180deg,
    var(--accent-color),
    var(--secondary-accent)
  );
  animation: borderScan 6s linear infinite;
}

.nav-bar .logo {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  margin-bottom: 20px;
  background: linear-gradient(
    135deg,
    var(--accent-color),
    var(--secondary-accent)
  );
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
  color: #ffffff;
  flex-shrink: 0;
  box-shadow: var(--accent-glow);
  animation: pulseGlow 3s ease-in-out infinite;
  writing-mode: vertical-rl;
  letter-spacing: 2px;
}

.nav-btn {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s ease;
  color: #ffffff;
  background: transparent;
  border: 1px solid transparent;
  outline: none;
  box-shadow: none;
  flex-shrink: 0;
}

.nav-btn:hover {
  color: var(--accent-color);
  background: var(--hover-bg);
  border-color: var(--accent-color);
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
}

.nav-btn.active {
  color: var(--accent-color);
  background: var(--accent-bg);
  border: 1px solid var(--accent-color);
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.4);
}

/* 项目列表面板 */
.project-panel {
  width: 155px;
  background: var(--bg-tertiary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  animation: slideFadeIn 0.3s ease-out forwards;
}

/* 会话列表面板 */
.conv-panel {
  width: 195px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  animation: slideFadeIn 0.4s ease-out forwards;
}

/* 搜索列表面板 */
.search-panel {
  width: 350px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
  animation: slideFadeIn 0.3s ease-out forwards;
}

.panel-title {
  padding: 16px 12px 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-color);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  font-family: var(--font-display);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  text-shadow: 0 0 5px rgba(0, 212, 255, 0.3);
}

.badge {
  background: var(--accent-bg);
  color: var(--accent-color);
  font-size: 10px;
  font-family: var(--font-display);
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid var(--accent-color);
  box-shadow: 0 0 8px rgba(0, 212, 255, 0.2);
}

.panel-list {
  flex: 1;
  overflow-y: auto;
}

/* 项目行 */
.project-item {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #ffffff;
  border-left: 2px solid transparent;
  transition: all 0.2s ease;
  white-space: nowrap;
  overflow: hidden;
}

.project-item:hover {
  color: var(--accent-color);
  background: var(--hover-bg);
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.1);
}

.project-item.active {
  color: var(--text-primary);
  background: var(--accent-bg);
  border-left-color: var(--accent-color);
  font-weight: 600;
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.2);
}

.project-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
}

.chevron {
  flex-shrink: 0;
  opacity: 0.6;
}

/* 会话行 */
.conv-item {
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-left: 2px solid transparent;
}

.conv-item:hover {
  background: var(--hover-bg);
  border-left-color: var(--accent-color);
  box-shadow: 4px 0 10px rgba(0, 212, 255, 0.1);
  transform: translateX(2px);
}

.conv-item.active {
  background: var(--accent-bg);
  border-left-color: var(--accent-color);
  box-shadow: 4px 0 15px rgba(0, 212, 255, 0.2);
}

.conv-title {
  font-size: 13px;
  color: #ffffff;
  margin-bottom: 4px;
}

.conv-item.active .conv-title {
  color: #ffffff;
  font-weight: 600;
}

.conv-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.conv-hash {
  font-family: var(--font-mono);
  font-size: 10px;
  background: var(--bg-tertiary);
  color: #ffffff;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid var(--border-color);
}

.conv-time {
  font-size: 11px;
  color: #ffffff;
  font-family: var(--font-mono);
}

/* 搜索视图内容 */
.search-view-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
}

.search-view-input {
  flex-shrink: 0;
}

.search-results-list {
  flex: 1;
  overflow-y: auto;
  margin-top: 12px;
}

/* 主内容区 */
.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.loading,
.empty-text {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

/* 视图容器 */
.pane-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.pane-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.projects-section,
.sessions-section {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.pane-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  border-image: linear-gradient(
      90deg,
      transparent,
      var(--accent-color),
      transparent
    )
    1;
}

.pane-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  font-family: var(--font-display);
  color: var(--accent-color);
  letter-spacing: 1px;
  text-transform: uppercase;
}

.section-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-display);
  color: var(--accent-color);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.pane-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  min-height: 0;
}

.list-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  min-height: 0;
}

.list-item {
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 4px;
  color: #ffffff;
  font-size: 13px;
  border: 1px solid transparent;
}

.list-item:hover {
  background: var(--hover-bg);
  color: var(--accent-color);
  border-color: var(--accent-color);
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.15);
  transform: translateX(3px);
}

.list-item.active {
  background: var(--accent-bg);
  color: var(--accent-color);
  border-color: var(--accent-color);
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.25);
}

.item-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.session-id {
  font-size: 10px;
  font-family: var(--font-mono);
  color: #ffffff;
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--border-color);
}

.session-time {
  font-size: 10px;
  color: #ffffff;
  font-family: var(--font-mono);
}

.loading,
.empty-text {
  padding: 20px;
  text-align: center;
  color: #ffffff;
  font-size: 13px;
}

/* 右侧主内容区 */
.main-pane {
  flex: 1;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

/* 仪表盘主区域 */
.dashboard-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 28px 32px;
  gap: 22px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.dashboard-loading,
.dashboard-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  min-height: 400px;
}

.dashboard-empty .empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
  filter: drop-shadow(0 0 10px rgba(0, 212, 255, 0.3));
}

.dashboard-main-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dashboard-chart-section {
  background: var(--card-bg-glass);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  padding: 20px;
}

/* 欢迎屏幕 */
.welcome-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  overflow: hidden;
  min-height: 0;
  animation: scaleIn 0.5s ease-out forwards;
}

.welcome-icon {
  font-size: 72px;
  margin-bottom: 24px;
  opacity: 0.8;
  filter: drop-shadow(0 0 20px rgba(0, 212, 255, 0.3));
  animation: pulseGlow 4s ease-in-out infinite;
}

.welcome-title {
  margin: 0 0 10px 0;
  font-size: 28px;
  font-weight: 600;
  font-family: var(--font-display);
  color: var(--accent-color);
  letter-spacing: 2px;
  animation: textGlow 3s ease-in-out infinite;
}

.welcome-subtitle {
  margin: 0 0 28px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.shortcut-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--accent-color);
  border-radius: 8px;
  font-size: 13px;
  color: var(--accent-color);
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.2);
}

.hint-icon {
  font-size: 16px;
  color: var(--accent-color);
}

.hint-key {
  padding: 4px 8px;
  background: var(--bg-primary);
  border: 1px solid var(--accent-color);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-color);
  box-shadow: 0 0 8px rgba(0, 212, 255, 0.2);
}

.hint-text {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-family: var(--font-display);
}

.welcome-hint {
  margin-top: 16px;
  font-size: 13px;
  color: var(--text-secondary);
}

/* 对话视图 */
.chat-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  animation: slideFadeIn 0.4s ease-out forwards;
}

.chat-header {
  height: 50px;
  border-bottom: 1px solid var(--border-color);
  border-image: linear-gradient(
      90deg,
      transparent,
      var(--accent-color),
      transparent
    )
    1;
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 10px;
  background: var(--bg-tertiary);
  flex-shrink: 0;
}

.chat-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.chat-project {
  font-size: 15px;
  font-weight: 600;
  font-family: var(--font-display);
  color: var(--accent-color);
  letter-spacing: 1px;
}

.chat-session {
  background: var(--bg-primary);
  color: var(--text-muted);
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.empty-messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  overflow: hidden;
  min-height: 0;
}

.empty-icon {
  font-size: 56px;
  margin-bottom: 16px;
  opacity: 0.6;
  filter: drop-shadow(0 0 10px rgba(0, 212, 255, 0.3));
}

.empty-messages p {
  font-size: 14px;
}

/* 消息列表 */
.messages-wrapper {
  flex: 1;
  display: flex;
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
  min-height: 0;
}

.message {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  animation: slideFadeIn 0.5s ease-out forwards;
  opacity: 0;
  animation-delay: calc(var(--message-index, 0) * 0.05s);
}

.message-timeline-point {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 10px;
  box-shadow: 0 0 8px currentColor;
}

.message.user .message-timeline-point {
  background: var(--accent-color);
  color: var(--accent-color);
}

.message.assistant .message-timeline-point {
  background: var(--success-color);
  color: var(--success-color);
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.message-role {
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-display);
}

.message.user .message-role {
  color: var(--accent-color);
  text-shadow: 0 0 5px rgba(0, 212, 255, 0.3);
}

.message.assistant .message-role {
  color: var(--success-color);
  text-shadow: 0 0 5px rgba(0, 255, 157, 0.3);
}

.message-index {
  font-size: 11px;
  color: #ffffff;
  font-family: var(--font-mono);
}

.message-body {
  font-size: 14px;
  color: #ffffff;
  line-height: 1.7;
}

.message.user .message-body {
  background: rgba(0, 212, 255, 0.05);
  padding: 12px 16px;
  border-radius: 8px;
  border-left: 3px solid var(--accent-color);
  box-shadow: 2px 0 10px rgba(0, 212, 255, 0.1);
}

/* 终端风格工具调用面板 */
.tool-calls-terminal {
  margin-top: 10px;
}

.terminal-panel {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.2s ease;
}

.terminal-panel:hover {
  border-color: var(--accent-color);
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.15);
}

.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
  background: var(--bg-tertiary);
  transition: all 0.2s ease;
  list-style: none;
}

.terminal-header::-webkit-details-marker {
  display: none;
}

.terminal-header:hover {
  background: var(--hover-bg);
}

.terminal-panel[open] .terminal-header {
  background: var(--hover-bg);
  border-bottom: 1px solid var(--accent-color);
}

.terminal-prompt {
  color: var(--accent-color);
  font-size: 12px;
  font-family: var(--font-display);
  letter-spacing: 1px;
}

.terminal-text {
  color: #ffffff;
  font-size: 12px;
  font-family: var(--font-sans);
}

.terminal-badge {
  background: var(--accent-bg);
  color: var(--accent-color);
  font-size: 10px;
  font-family: var(--font-display);
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid var(--accent-color);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
}

.terminal-body {
  padding: 10px 14px;
  max-height: 320px;
  overflow-y: auto;
}

.terminal-command {
  margin-bottom: 10px;
}

.terminal-command:last-child {
  margin-bottom: 0;
}

.command-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.command-prompt {
  color: var(--accent-color);
  font-family: var(--font-mono);
  font-size: 11px;
}

.command-name {
  color: var(--success-color);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  text-shadow: 0 0 5px rgba(0, 255, 157, 0.3);
}

.copy-command-btn {
  margin-left: auto;
  padding: 3px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: #ffffff;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: var(--font-sans);
}

.copy-command-btn:hover {
  background: var(--accent-bg);
  border-color: var(--accent-color);
  color: var(--accent-color);
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
}

.copy-command-btn:active {
  transform: scale(0.95);
}

.command-args {
  margin: 0;
  padding: 10px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  font-size: 11px;
  font-family: var(--font-mono);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 180px;
  overflow-y: auto;
  color: #ffffff;
  border: 1px solid var(--border-color);
}

/* 仪表盘样式 */
.dashboard-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}

.stat-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    var(--accent-color),
    var(--secondary-accent),
    var(--accent-color)
  );
}

.stat-card:hover {
  transform: translateY(-4px);
  border-color: var(--accent-color);
  box-shadow: var(--accent-glow);
}

.stat-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--accent-color);
  line-height: 1;
  margin-bottom: 6px;
  text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-family: var(--font-display);
}

.project-stats-section {
  margin-top: 28px;
}

.project-stats-section .section-title {
  margin-bottom: 20px;
  padding: 0;
}

.project-stats-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.project-stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.project-stat-item:hover {
  border-color: var(--accent-color);
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.15);
  transform: translateX(2px);
}

.project-stat-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 180px;
}

.project-stat-rank {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-color);
  color: #000;
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-display);
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.4);
}

.project-stat-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-stat-bar {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 24px;
}

.project-stat-bar-fill {
  height: 8px;
  background: linear-gradient(
    90deg,
    var(--accent-color),
    var(--secondary-accent)
  );
  border-radius: 4px;
  min-width: 0;
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.4);
}

.project-stat-count {
  font-size: 13px;
  color: var(--accent-color);
  font-weight: 600;
  font-family: var(--font-display);
  text-shadow: 0 0 5px rgba(0, 212, 255, 0.3);
  white-space: nowrap;
}

/* 搜索视图样式 */
.search-view-input {
  margin-bottom: 16px;
}

.search-results-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.search-result-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 全局搜索弹窗样式 */
.search-dialog :deep(.el-dialog) {
  background: var(--bg-primary);
  border: 1px solid var(--accent-color);
  box-shadow: var(--accent-glow);
  border-radius: 12px;
}

.search-dialog :deep(.el-dialog__header) {
  border-bottom: 1px solid var(--border-color);
  border-image: linear-gradient(
      90deg,
      transparent,
      var(--accent-color),
      transparent
    )
    1;
}

.search-dialog :deep(.el-dialog__title) {
  color: var(--accent-color);
  font-family: var(--font-display);
  font-size: 16px;
  letter-spacing: 1px;
}

.search-dialog :deep(.el-dialog__body) {
  padding: 16px;
}

.search-input :deep(.el-input__wrapper) {
  background: var(--bg-primary);
  box-shadow: none;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.search-input :deep(.el-input__wrapper:hover) {
  border-color: var(--accent-color);
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.2);
}

.search-input :deep(.el-input__wrapper.is-focus) {
  border-color: var(--accent-color);
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.3);
}

.search-input :deep(.el-input__inner) {
  color: var(--text-primary);
  background: transparent;
  font-family: var(--font-sans);
}

.search-input :deep(.el-input__inner::placeholder) {
  color: var(--text-muted);
}

.search-input :deep(.el-input__prefix) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-input :deep(.el-input__prefix span) {
  font-size: 16px;
  opacity: 0.6;
  color: var(--accent-color);
}

.search-results {
  max-height: 400px;
  overflow-y: auto;
}

.search-loading,
.search-empty,
.search-hint {
  padding: 24px;
  text-align: center;
  color: #ffffff;
  font-size: 14px;
}

.search-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.search-result-item {
  padding: 10px 14px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
  border: 1px solid transparent;
}

.search-result-item:hover {
  background: var(--hover-bg);
  border-color: var(--accent-color);
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.15);
}

.search-result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
}

.search-project {
  font-weight: 600;
  color: #ffffff;
}

.search-session {
  font-family: var(--font-mono);
  color: #ffffff;
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  font-size: 10px;
}

.search-preview {
  font-size: 12px;
  color: #ffffff;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.search-result-item.selected {
  background: var(--accent-bg);
  border-left: 3px solid var(--accent-color);
  border-color: var(--accent-color);
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.2);
}

.search-result-item.selected .search-preview {
  color: #ffffff;
}

/* 快捷键帮助弹窗样式 */
.shortcuts-dialog :deep(.el-dialog) {
  background: var(--bg-primary);
  border: 1px solid var(--accent-color);
  box-shadow: var(--accent-glow);
}

.shortcuts-dialog :deep(.el-dialog__header) {
  border-bottom: 1px solid var(--border-color);
  border-image: linear-gradient(
      90deg,
      transparent,
      var(--accent-color),
      transparent
    )
    1;
}

.shortcuts-dialog :deep(.el-dialog__title) {
  color: var(--accent-color);
  font-family: var(--font-display);
  letter-spacing: 1px;
}

.shortcuts-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.shortcuts-list {
  display: flex;
  flex-direction: column;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color);
  transition: all 0.2s ease;
}

.shortcut-item:hover {
  background: var(--hover-bg);
  box-shadow: inset 3px 0 0 var(--accent-color);
}

.shortcut-item:last-child {
  border-bottom: none;
}

.shortcut-key {
  flex-shrink: 0;
}

.shortcut-key kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--accent-color);
  border-radius: 6px;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-color);
  min-width: 55px;
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.2);
}

.shortcut-info {
  flex: 1;
}

.shortcut-desc {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
  font-family: var(--font-sans);
}

.shortcut-action {
  font-size: 12px;
  color: var(--text-muted);
}

.shortcuts-footer {
  padding: 16px 20px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-color);
  border-image: linear-gradient(
      90deg,
      transparent,
      var(--accent-color),
      transparent
    )
    1;
  text-align: center;
}

.shortcuts-footer p {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.shortcuts-footer kbd {
  padding: 4px 8px;
  background: var(--bg-primary);
  border: 1px solid var(--accent-color);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  margin: 0 3px;
  color: var(--accent-color);
  box-shadow: 0 0 8px rgba(0, 212, 255, 0.2);
}

.search-highlight {
  background: var(--accent-bg);
  color: var(--accent-color);
  padding: 0 3px;
  border-radius: 3px;
  border: 1px solid rgba(0, 212, 255, 0.3);
  font-weight: 600;
  box-shadow: 0 0 5px rgba(0, 212, 255, 0.2);
}

.search-session-id {
  font-family: var(--font-mono);
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  font-size: 10px;
}

/* 搜索预览窗格 */
.preview-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.preview-header {
  padding: 14px 24px;
  border-bottom: 1px solid var(--border-color);
  border-image: linear-gradient(
      90deg,
      transparent,
      var(--accent-color),
      transparent
    )
    1;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preview-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.preview-project {
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font-display);
  color: var(--accent-color);
  letter-spacing: 1px;
}

.preview-session {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  padding: 3px 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.preview-jump-btn {
  padding: 8px 16px;
  background: linear-gradient(
    135deg,
    var(--accent-color),
    var(--secondary-accent)
  );
  color: #000;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-display);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.3);
  letter-spacing: 1px;
}

.preview-jump-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 25px rgba(0, 212, 255, 0.5);
}

.preview-loading,
.preview-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  overflow: hidden;
  min-height: 0;
}

.preview-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
  min-height: 0;
}

.preview-message {
  margin-bottom: 24px;
  display: flex;
  gap: 12px;
}

.preview-message.user .preview-message-role {
  color: var(--accent-color);
  text-shadow: 0 0 5px rgba(0, 212, 255, 0.3);
}

.preview-message.assistant .preview-message-role {
  color: var(--success-color);
  text-shadow: 0 0 5px rgba(0, 255, 157, 0.3);
}

.preview-message-role {
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-display);
  flex-shrink: 0;
  width: 45px;
  margin-top: 9px;
}

.preview-message-content {
  color: var(--text-primary);
  line-height: 1.6;
  font-size: 14px;
  flex: 1;
  min-width: 0;
}

.preview-message-content :deep(p) {
  margin: 0.5em 0;
}

.preview-message-content :deep(code) {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-size: 0.85em;
  color: var(--accent-color);
}

.preview-message-content :deep(pre) {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  overflow-x: auto;
}
</style>

<style>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
}

#app {
  height: 100vh;
  width: 100vw;
}
</style>
