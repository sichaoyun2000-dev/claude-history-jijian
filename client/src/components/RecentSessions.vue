<script setup lang="ts">
import { computed } from 'vue';

interface SessionData {
  sessionId: string;
  projectName: string;
  projectPath: string;
  filePath: string;
  modifiedAt: Date;
  messageCount: number;
  summary?: string;
}

interface Props {
  data: SessionData[];
}

const props = defineProps<Props>();

// 格式化时间
const formatTime = (date: Date) => {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

// 生成会话标题摘要
const getSessionSummary = (sessionId: string, projectName: string) => {
  return `${projectName}`;
};

// 定义 emit
const emit = defineEmits<{
  (e: 'click', session: SessionData): void;
}>();
</script>

<template>
  <div class="recent-sessions">
    <div class="section-header">
      <h3 class="section-title">最近访问</h3>
      <span class="section-count">{{ data.length }}</span>
    </div>

    <div v-if="data.length === 0" class="empty-state">
      <div class="empty-icon">🕐</div>
      <p class="empty-text">暂无最近访问记录</p>
    </div>

    <div v-else class="sessions-list">
      <div
        v-for="(session, index) in data"
        :key="session.sessionId"
        class="session-card"
        @click="emit('click', session)"
      >
        <div class="session-rank">{{ index + 1 }}</div>
        <div class="session-content">
          <div class="session-project">{{ session.projectName }}</div>
          <div class="session-info">
            <span class="session-summary">{{ session.summary || '无简介' }}</span>
            <span class="session-messages">{{ session.messageCount }} 条消息</span>
          </div>
        </div>
        <div class="session-meta">
          <span class="session-time">{{ formatTime(session.modifiedAt) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recent-sessions {
  padding: 24px;
  background: var(--card-bg-glass);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
  animation: slideFadeIn 0.7s ease-out forwards;
}

.recent-sessions::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent-color), var(--secondary-accent), var(--accent-color));
  animation: borderScan 4s linear infinite reverse;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.section-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  font-family: var(--font-display);
  color: var(--accent-color);
  letter-spacing: 2px;
  text-transform: uppercase;
  animation: textGlow 3s ease-in-out infinite;
}

.section-count {
  padding: 4px 12px;
  background: var(--accent-bg);
  color: var(--accent-color);
  border: 1px solid var(--accent-color);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-display);
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.2);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 40px;
  margin-bottom: 12px;
  opacity: 0.5;
  filter: drop-shadow(0 0 8px rgba(0, 212, 255, 0.3));
}

.empty-text {
  font-size: 13px;
  margin: 0;
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.session-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
  overflow: hidden;
}

.session-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.05), transparent);
  transition: left 0.5s ease;
}

.session-card:hover::before {
  left: 100%;
}

.session-card:hover {
  background: var(--hover-bg);
  border-color: var(--accent-color);
  transform: translateX(6px);
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.15);
}

.session-rank {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  font-size: 12px;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--text-muted);
  flex-shrink: 0;
}

.session-card:nth-child(1) .session-rank {
  background: rgba(255, 215, 0, 0.15);
  border-color: rgba(255, 215, 0, 0.5);
  color: #FFD700;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.3);
}

.session-card:nth-child(2) .session-rank {
  background: rgba(192, 192, 192, 0.15);
  border-color: rgba(192, 192, 192, 0.5);
  color: #C0C0C0;
  box-shadow: 0 0 10px rgba(192, 192, 192, 0.2);
}

.session-card:nth-child(3) .session-rank {
  background: rgba(124, 58, 237, 0.15);
  border-color: rgba(124, 58, 237, 0.5);
  color: #7c3aed;
  box-shadow: 0 0 10px rgba(124, 58, 237, 0.3);
}

.session-content {
  flex: 1;
  min-width: 0;
}

.session-project {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-summary {
  font-size: 12px;
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.session-messages {
  font-size: 11px;
  color: var(--accent-color);
  font-weight: 500;
  font-family: var(--font-display);
}

.session-meta {
  flex-shrink: 0;
}

.session-time {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  font-family: var(--font-mono);
}
</style>
