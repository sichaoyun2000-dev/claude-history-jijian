<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  data: { date: string; count: number }[];
}

const props = defineProps<Props>();

// 计算统计数据
const stats = computed(() => {
  if (!props.data || !Array.isArray(props.data)) {
    return {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      total: 0,
      avgDaily: 0,
      bestDay: { date: '', count: 0 }
    };
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // 获取本周的日期范围
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  // 获取本月的第一天
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  let todayCount = 0;
  let thisWeekCount = 0;
  let thisMonthCount = 0;
  let totalCount = 0;
  let bestDay = { date: '', count: 0 };
  const dayCounts: number[] = [];

  props.data.forEach(item => {
    const itemDate = new Date(item.date);
    const dateStr = item.date;
    const count = typeof item.count === 'number' ? item.count : 0;

    totalCount += count;
    dayCounts.push(count);

    // 今日统计
    if (dateStr === todayStr) {
      todayCount += count;
    }

    // 本周统计
    if (itemDate >= weekStart && itemDate <= weekEnd) {
      thisWeekCount += count;
    }

    // 本月统计
    if (itemDate >= monthStart && itemDate <= today) {
      thisMonthCount += count;
    }

    // 最多的一天
    if (count > bestDay.count) {
      bestDay = { date: dateStr, count };
    }
  });

  // 计算平均每日对话数（有数据的日期）
  const daysWithData = dayCounts.filter(c => c > 0).length || 1;
  const avgDaily = Math.round(totalCount / daysWithData);

  return {
    today: todayCount,
    thisWeek: thisWeekCount,
    thisMonth: thisMonthCount,
    total: totalCount,
    avgDaily,
    bestDay
  };
});

// 格式化日期
const formatDate = (date: string) => {
  const d = new Date(date);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}月${day}日`;
};

// 计算环比增长
const getGrowth = (current: number, previous: number) => {
  if (previous === 0) return null;
  const growth = ((current - previous) / previous) * 100;
  return {
    value: growth.toFixed(1),
    isPositive: growth >= 0
  };
};

// 计算昨日数据用于对比
const yesterdayCount = computed(() => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const item = props.data?.find(d => d.date === yesterdayStr);
  return item?.count || 0;
});

const todayGrowth = computed(() => getGrowth(stats.value.today, yesterdayCount.value));

// 计算上周数据用于对比
const lastWeekCount = computed(() => {
  const today = new Date();
  const lastWeekStart = new Date(today);
  lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
  const lastWeekEnd = new Date(lastWeekStart);
  lastWeekEnd.setDate(lastWeekStart.getDate() + 6);

  return props.data?.reduce((sum, item) => {
    const itemDate = new Date(item.date);
    if (itemDate >= lastWeekStart && itemDate <= lastWeekEnd) {
      return sum + (item.count || 0);
    }
    return sum;
  }, 0) || 0;
});

const weekGrowth = computed(() => getGrowth(stats.value.thisWeek, lastWeekCount.value));
</script>

<template>
  <div class="activity-stats">
    <div class="section-header">
      <h3 class="section-title">活动统计</h3>
    </div>

    <div class="stats-grid">
      <!-- 今日对话 -->
      <div class="stat-item">
        <div class="stat-icon">📅</div>
        <div class="stat-content">
          <div class="stat-label">今日对话</div>
          <div class="stat-value">{{ stats.today }}</div>
          <div class="stat-change" v-if="todayGrowth">
            <span :class="todayGrowth.isPositive ? 'positive' : 'negative'">
              {{ todayGrowth.isPositive ? '↑' : '↓' }} {{ todayGrowth.value }}%
            </span>
            <span class="change-label">较昨日</span>
          </div>
        </div>
      </div>

      <!-- 本周对话 -->
      <div class="stat-item">
        <div class="stat-icon">📊</div>
        <div class="stat-content">
          <div class="stat-label">本周对话</div>
          <div class="stat-value">{{ stats.thisWeek }}</div>
          <div class="stat-change" v-if="weekGrowth">
            <span :class="weekGrowth.isPositive ? 'positive' : 'negative'">
              {{ weekGrowth.isPositive ? '↑' : '↓' }} {{ weekGrowth.value }}%
            </span>
            <span class="change-label">较上周</span>
          </div>
        </div>
      </div>

      <!-- 本月对话 -->
      <div class="stat-item">
        <div class="stat-icon">📈</div>
        <div class="stat-content">
          <div class="stat-label">本月对话</div>
          <div class="stat-value">{{ stats.thisMonth }}</div>
          <div class="stat-extra">
            <span class="extra-label">累计</span>
          </div>
        </div>
      </div>

      <!-- 平均每日 -->
      <div class="stat-item">
        <div class="stat-icon">🎯</div>
        <div class="stat-content">
          <div class="stat-label">平均每日</div>
          <div class="stat-value">{{ stats.avgDaily }}</div>
          <div class="stat-extra">
            <span class="extra-label">有记录日均</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 最佳一天 -->
    <div v-if="stats.bestDay.count > 0" class="best-day">
      <div class="best-day-label">最活跃的一天</div>
      <div class="best-day-content">
        <span class="best-day-date">{{ formatDate(stats.bestDay.date) }}</span>
        <span class="best-day-count">{{ stats.bestDay.count }} 条对话</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.activity-stats {
  background: var(--card-bg-glass);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  padding: 24px;
  position: relative;
  overflow: hidden;
  animation: scaleIn 0.5s ease-out forwards;
}

.activity-stats::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(0, 212, 255, 0.05),
    transparent
  );
  animation: borderScan 3s linear infinite;
  pointer-events: none;
}

.section-header {
  margin-bottom: 24px;
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 16px;
  background: var(--bg-primary);
  border-radius: 10px;
  border: 1px solid var(--border-color);
  transition: all var(--animate-fast) ease;
  position: relative;
  overflow: hidden;
}

.stat-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(124, 58, 237, 0.05));
  opacity: 0;
  transition: opacity var(--animate-fast) ease;
}

.stat-item:hover {
  transform: translateY(-4px) scale(1.02);
  border-color: var(--accent-color);
  box-shadow: var(--accent-glow);
}

.stat-item:hover::before {
  opacity: 1;
}

.stat-icon {
  font-size: 32px;
  line-height: 1;
  filter: drop-shadow(0 0 8px rgba(0, 212, 255, 0.3));
}

.stat-content {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.stat-label {
  font-size: 12px;
  color: #ffffff;
  margin-bottom: 6px;
  font-family: var(--font-display);
  letter-spacing: 1px;
  text-transform: uppercase;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--accent-color);
  line-height: 1.2;
  margin-bottom: 6px;
  text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
  animation: pulseGlow 3s ease-in-out infinite;
}

.stat-change {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.stat-change .positive {
  color: var(--success-color);
  text-shadow: var(--success-glow);
  font-weight: 600;
}

.stat-change .negative {
  color: var(--danger-color);
  text-shadow: var(--danger-glow);
  font-weight: 600;
}

.change-label {
  color: #ffffff;
}

.stat-extra {
  font-size: 11px;
  color: #ffffff;
}

.best-day {
  padding: 20px 16px;
  background: var(--bg-primary);
  border-radius: 10px;
  border: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
  transition: all var(--animate-fast) ease;
}

.best-day:hover {
  border-color: var(--secondary-accent);
  box-shadow: var(--secondary-glow);
}

.best-day::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.1), transparent);
  opacity: 0;
  transition: opacity var(--animate-fast) ease;
}

.best-day:hover::before {
  opacity: 1;
}

.best-day-label {
  font-size: 12px;
  color: #ffffff;
  margin-bottom: 8px;
  font-family: var(--font-display);
  letter-spacing: 1px;
  text-transform: uppercase;
  position: relative;
  z-index: 1;
}

.best-day-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 1;
}

.best-day-date {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.best-day-count {
  font-size: 18px;
  color: var(--secondary-accent);
  font-weight: 700;
  font-family: var(--font-display);
  text-shadow: 0 0 10px rgba(124, 58, 237, 0.5);
}
</style>
