<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';

interface Props {
  data: {
    date: string;
    count: number;
  }[];
}

const props = defineProps<Props>();

// 响应式容器宽度
const containerWidth = ref(0);

// 周几标签
const weekDays = ['周一', '周三', '周五'];

// 月份标签
const months = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

// 计算颜色等级
const getColorLevel = (count: number) => {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
};

// 计算单元格大小（自适应）
const cellSize = computed(() => {
  // 根据容器宽度动态计算单元格大小
  if (containerWidth.value < 500) {
    return 12; // 小屏幕
  } else if (containerWidth.value < 700) {
    return 14; // 中等屏幕
  } else {
    return 16; // 大屏幕
  }
});

// 计算间隔大小
const gapSize = computed(() => Math.max(2, Math.floor(cellSize.value / 4)));

// 监听窗口大小变化
const handleResize = () => {
  const graphContainer = document.querySelector('.graph-scroll');
  if (graphContainer) {
    containerWidth.value = graphContainer.clientWidth;
  }
};

onMounted(() => {
  handleResize();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

// 格式化数据为 53 周 x 7 天的网格
const weeks = computed(() => {
  const result: (number | null)[][] = [];

  // 找到最早的日期
  if (props.data.length === 0) return result;

  // 初始化 53 周，每周 7 天
  for (let w = 0; w < 53; w++) {
    result[w] = Array(7).fill(null);
  }

  // 填充数据
  const dataMap = new Map(props.data.map(d => [d.date, d.count]));

  // 获取最早和最晚日期
  const dates = props.data.map(d => new Date(d.date));
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

  // 从一年前的第一个周日开始
  const startDate = new Date(minDate);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  // 填充网格
  let currentDate = new Date(startDate);
  const endDate = new Date(maxDate);
  endDate.setDate(endDate.getDate() + 6 - endDate.getDay());

  let weekIndex = 0;
  let dayIndex = 0;

  while (currentDate <= endDate && weekIndex < 53) {
    const dateKey = currentDate.toISOString().split('T')[0];
    const count = dataMap.get(dateKey ?? '') ?? 0;

    result[weekIndex]![dayIndex] = count;

    dayIndex++;
    if (dayIndex >= 7) {
      dayIndex = 0;
      weekIndex++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
});

// 计算总计
const totalContributions = computed(() => {
  return props.data.reduce((sum, d) => sum + d.count, 0);
});

// 计算最高贡献
const maxContributions = computed(() => {
  return Math.max(...props.data.map(d => d.count), 0);
});
</script>

<template>
  <div class="contribution-graph">
    <div class="graph-header">
      <div class="graph-title">
        <span class="title-text">{{ totalContributions }}</span>
        <span class="title-label">contributions</span>
      </div>
      <div class="graph-legend">
        <span class="legend-label">Less</span>
        <div class="legend-levels">
          <span v-for="i in 5" :key="i" class="legend-level" :class="`level-${i - 1}`"></span>
        </div>
        <span class="legend-label">More</span>
      </div>
    </div>

    <div class="graph-container" ref="graphContainer">
      <div class="week-labels">
        <span v-for="(day, i) in weekDays" :key="i" class="week-label" :style="{ top: `${i * 2.4 * cellSize + 12}px` }">
          {{ day }}
        </span>
      </div>

      <div class="graph-scroll">
        <div class="weeks" :style="{ gap: `${gapSize}px` }">
          <div v-for="(week, w) in weeks" :key="w" class="week" :style="{ gap: `${gapSize}px` }">
            <div v-for="(day, d) in week" :key="`${w}-${d}`"
              class="day-cell"
              :style="{
                width: `${cellSize}px`,
                height: `${cellSize}px`
              }"
              :class="'level-' + (day === null ? 0 : getColorLevel(day))"
              :title="day === null ? 'No data' : `${day} contributions`"
            ></div>
          </div>
        </div>

        <div class="month-labels">
          <span v-for="(m, i) in 12" :key="m" class="month-label" :style="{ left: `${i * 4.4 * (cellSize + gapSize) + 40}px` }">
            {{ months[m - 1] }}
          </span>
        </div>
      </div>
    </div>

    <div class="graph-footer">
      <span v-if="totalContributions === 0" class="empty-text">暂无贡献数据</span>
      <span v-else class="stats-text">
        最高单日: {{ maxContributions }} 条对话
      </span>
    </div>
  </div>
</template>

<style scoped>
.contribution-graph {
  padding: 24px;
  background: var(--card-bg-glass);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  overflow: visible;
  position: relative;
  animation: slideFadeIn 0.6s ease-out forwards;
}

.contribution-graph::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent-color), transparent);
  animation: borderScan 4s linear infinite;
}

.graph-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.graph-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.title-text {
  font-size: 32px;
  font-weight: 700;
  font-family: var(--font-display);
  color: var(--accent-color);
  text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
}

.title-label {
  font-size: 14px;
  color: var(--text-muted);
  font-family: var(--font-sans);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.graph-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-display);
}

.legend-levels {
  display: flex;
  gap: 3px;
}

.legend-level {
  width: 14px;
  height: 14px;
  border-radius: 2px;
  background: var(--border-color);
  border: 1px solid transparent;
  transition: all 0.2s ease;
}

.legend-level:hover {
  transform: scale(1.2);
  box-shadow: var(--accent-glow);
}

.legend-level.level-1 {
  background: rgba(0, 212, 255, 0.2);
  border-color: rgba(0, 212, 255, 0.2);
}

.legend-level.level-2 {
  background: rgba(0, 212, 255, 0.4);
  border-color: rgba(0, 212, 255, 0.4);
}

.legend-level.level-3 {
  background: rgba(0, 212, 255, 0.6);
  border-color: rgba(0, 212, 255, 0.6);
}

.legend-level.level-4 {
  background: rgba(0, 212, 255, 0.9);
  border-color: var(--accent-color);
  box-shadow: 0 0 8px rgba(0, 212, 255, 0.5);
}

.graph-container {
  position: relative;
  display: flex;
  gap: 8px;
  min-width: 0;
}

.week-labels {
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 32px;
  width: 30px;
  pointer-events: none;
}

.week-label {
  position: absolute;
  font-size: 11px;
  color: var(--text-muted);
  transform: translateX(-100%);
  font-family: var(--font-display);
}

.graph-scroll {
  flex: 1;
  min-width: 0;
  padding: 0 0 40px 0;
}

.weeks {
  display: flex;
}

.week {
  display: flex;
  flex-direction: column;
}

.day-cell {
  border-radius: 2px;
  background: var(--border-color);
  transition: all 0.2s ease;
  flex-shrink: 0;
  position: relative;
  border: 1px solid transparent;
}

.day-cell:hover {
  transform: scale(1.4);
  outline: 2px solid var(--accent-color);
  outline-offset: 1px;
  box-shadow: var(--accent-glow);
  z-index: 10;
}

.day-cell.level-1 {
  background: rgba(0, 212, 255, 0.15);
  border-color: rgba(0, 212, 255, 0.15);
}

.day-cell.level-2 {
  background: rgba(0, 212, 255, 0.4);
  border-color: rgba(0, 212, 255, 0.4);
  box-shadow: 0 0 4px rgba(0, 212, 255, 0.2);
}

.day-cell.level-3 {
  background: rgba(0, 212, 255, 0.7);
  border-color: var(--accent-color);
  box-shadow: 0 0 8px rgba(0, 212, 255, 0.4);
}

.day-cell.level-4 {
  background: rgba(0, 212, 255, 1);
  border-color: var(--accent-color);
  box-shadow: var(--accent-glow);
}

.month-labels {
  position: relative;
  height: 24px;
  margin-top: 8px;
  min-width: 100%;
}

.month-label {
  position: absolute;
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-display);
}

.graph-footer {
  margin-top: 16px;
  text-align: center;
}

.empty-text {
  color: var(--text-muted);
  font-size: 13px;
}

.stats-text {
  color: var(--text-secondary);
  font-size: 14px;
  font-family: var(--font-display);
  letter-spacing: 1px;
}
</style>
