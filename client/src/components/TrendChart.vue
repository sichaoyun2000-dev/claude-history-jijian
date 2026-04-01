<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  data: { date: string; count: number }[];
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '对话趋势'
});

// 科技霓虹色彩配置
const accentColor = '#00d4ff';
const gridColor = 'rgba(0, 212, 255, 0.15)';

// 处理数据 - 按月分组统计
const chartData = computed(() => {
  if (!props.data || !Array.isArray(props.data) || props.data.length === 0) {
    return [];
  }

  // 按月份分组
  const monthlyData = new Map<string, number>();

  props.data.forEach(item => {
    if (item.date && typeof item.count === 'number') {
      const monthKey = item.date.substring(0, 7); // YYYY-MM
      monthlyData.set(monthKey, (monthlyData.get(monthKey) || 0) + item.count);
    }
  });

  // 转换为数组并排序
  const result = Array.from(monthlyData.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-6); // 只保留最近6个月

  return result;
});

// 计算最大值
const maxValue = computed(() => {
  if (chartData.value.length === 0) return 10;
  return Math.max(...chartData.value.map(d => d.count), 1);
});

// 格式化月份显示
const formatMonth = (date: string) => {
  const [year, month] = date.split('-');
  return `${month}月`;
};

// 计算点坐标
const getPointCoords = (index: number, count: number) => {
  const paddingX = 60;
  const availableWidth = 520;
  const paddingY = 200;
  const availableHeight = 150;

  // 如果只有一个点，放在中间
  if (chartData.value.length === 1) {
    return {
      x: paddingX + availableWidth / 2,
      y: paddingY - (count / maxValue.value) * availableHeight
    };
  }

  const x = paddingX + (index / (chartData.value.length - 1)) * availableWidth;
  const y = paddingY - (count / maxValue.value) * availableHeight;
  return { x, y };
};

// 生成折线路径
const linePath = computed(() => {
  if (chartData.value.length === 0) return '';
  if (chartData.value.length === 1) return ''; // 单个点不画折线

  const points = chartData.value.map((item, index) => {
    const { x, y } = getPointCoords(index, item.count);
    return `${x},${y}`;
  });

  return points.join(' ');
});

// 生成渐变区域路径
const areaPath = computed(() => {
  if (chartData.value.length === 0) return '';
  if (chartData.value.length === 1) return ''; // 单个点不画渐变区域

  const firstPoint = getPointCoords(0, chartData.value[0]?.count || 0);
  const lastPoint = getPointCoords(chartData.value.length - 1, chartData.value[chartData.value.length - 1]?.count || 0);

  const points = chartData.value.map((item, index) => {
    const { x, y } = getPointCoords(index, item.count);
    return `${x},${y}`;
  });

  return `M ${firstPoint.x},200 L ${points.join(' L ')} L ${lastPoint.x},200 Z`;
});

// 判断是否显示单点模式
const isSinglePoint = computed(() => chartData.value.length === 1);
</script>

<template>
  <div class="trend-chart">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
      <span class="chart-period" v-if="chartData.length > 0">
        最近 {{ chartData.length }} 个月
      </span>
    </div>

    <div v-if="chartData.length === 0" class="empty-state">
      <div class="empty-icon">📈</div>
      <p class="empty-text">暂无数据</p>
    </div>

    <div v-else class="chart-container">
      <svg viewBox="0 0 640 280" class="trend-svg" preserveAspectRatio="xMidYMid meet">
        <!-- 定义渐变 -->
        <defs>
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" :stop-color="accentColor" stop-opacity="0.3" />
            <stop offset="100%" :stop-color="accentColor" stop-opacity="0" />
          </linearGradient>
        </defs>

        <!-- 网格线 -->
        <g class="grid-lines">
          <line v-for="i in 4" :key="i"
                :x1="60"
                :y1="50 + (i - 1) * 50"
                :x2="600"
                :y2="50 + (i - 1) * 50"
                :stroke="gridColor"
                stroke-width="1" />
        </g>

        <!-- Y轴标签 -->
        <g class="y-labels">
          <text v-for="i in 4" :key="i"
                :x="50"
                :y="55 + (i - 1) * 50"
                text-anchor="end"
                class="label">
            {{ Math.round(maxValue * (1 - (i - 1) / 4)) }}
          </text>
        </g>

        <!-- 渐变区域 -->
        <path v-if="!isSinglePoint && chartData.length > 1"
              :d="areaPath"
              fill="url(#areaGradient)" />

        <!-- 折线 -->
        <polyline v-if="!isSinglePoint && chartData.length > 1"
                  :points="linePath"
                  fill="none"
                  :stroke="accentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="trend-line" />

        <!-- 数据点 -->
        <g class="data-points">
          <g v-for="(item, index) in chartData" :key="index" class="point-group">
            <circle :cx="getPointCoords(index, item.count).x"
                    :cy="getPointCoords(index, item.count).y"
                    :r="isSinglePoint ? 8 : 6"
                    :fill="accentColor"
                    stroke="var(--bg-secondary)"
                    stroke-width="2"
                    class="data-point" />
            <circle :cx="getPointCoords(index, item.count).x"
                    :cy="getPointCoords(index, item.count).y"
                    :r="10"
                    fill="transparent"
                    class="point-hover" />
          </g>
        </g>

        <!-- X轴标签 -->
        <g class="x-labels">
          <text v-for="(item, index) in chartData" :key="index"
                :x="getPointCoords(index, item.count).x"
                :y="220"
                text-anchor="middle"
                class="label">
            {{ formatMonth(item.date) }}
          </text>
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.trend-chart {
  padding: 24px;
  background: var(--card-bg-glass);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
  animation: slideFadeIn 0.8s ease-out forwards;
}

.trend-chart::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 2px;
  height: 100%;
  background: linear-gradient(180deg, var(--accent-color), var(--secondary-accent), var(--accent-color));
  animation: borderScan 5s linear infinite;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.chart-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  font-family: var(--font-display);
  color: var(--accent-color);
  letter-spacing: 2px;
  text-transform: uppercase;
  animation: textGlow 3s ease-in-out infinite;
}

.chart-period {
  font-size: 12px;
  color: var(--text-muted);
  padding: 4px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  font-family: var(--font-display);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
  filter: drop-shadow(0 0 10px rgba(0, 212, 255, 0.3));
}

.empty-text {
  font-size: 14px;
  margin: 0;
}

.chart-container {
  width: 100%;
  min-width: 0;
}

.trend-svg {
  width: 100%;
  height: auto;
  overflow: visible;
  min-height: 200px;
}

.trend-line {
  filter: drop-shadow(0 0 8px rgba(0, 212, 255, 0.6)) drop-shadow(0 0 15px rgba(0, 212, 255, 0.3));
  animation: glowPulse 3s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% {
    filter: drop-shadow(0 0 8px rgba(0, 212, 255, 0.6)) drop-shadow(0 0 15px rgba(0, 212, 255, 0.3));
  }
  50% {
    filter: drop-shadow(0 0 12px rgba(0, 212, 255, 0.8)) drop-shadow(0 0 25px rgba(0, 212, 255, 0.5));
  }
}

.data-point {
  transition: all 0.2s ease;
}

.point-group:hover .data-point {
  r: 8;
  filter: drop-shadow(0 0 10px var(--accent-color));
}

.point-hover {
  cursor: pointer;
}

.point-hover:hover + .data-point {
  r: 8;
  filter: drop-shadow(0 0 10px var(--accent-color));
}

.label {
  font-size: 11px;
  font-family: var(--font-display);
  fill: var(--text-muted);
}

.data-points {
  pointer-events: none;
}

.point-group {
  pointer-events: all;
}

/* 响应式调整 */
@media (max-width: 640px) {
  .trend-chart {
    padding: 16px;
  }

  .chart-title {
    font-size: 14px;
  }
}
</style>
