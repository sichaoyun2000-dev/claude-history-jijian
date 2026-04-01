<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  data: { name: string; count: number }[];
}

const props = defineProps<Props>();

// 霓虹科技色彩数组
const colors = [
  '#00d4ff',
  '#7c3aed',
  '#00ff9d',
  '#ff006e',
  '#ffb700',
  '#06ffa5',
  '#3a86ff',
  '#8338ec',
  '#ff006e',
  '#fb5607',
  '#8ac926',
  '#1982c4',
];

// 为每个项目分配颜色
const chartData = computed(() => {
  // 确保数据存在且有效
  if (!props.data || !Array.isArray(props.data)) {
    return [];
  }
  return props.data
    .filter(item => item && typeof item.count === 'number' && item.count >= 0)
    .map((item, index) => ({
      name: item.name || 'Unknown',
      count: item.count,
      color: colors[index % colors.length],
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
});

// 计算总数
const total = computed(() => {
  if (chartData.value.length === 0) return 0;
  return chartData.value.reduce((sum, d) => {
    const count = typeof d.count === 'number' ? d.count : 0;
    return sum + count;
  }, 0);
});

// 计算百分比
const getPercentage = (count: number) => {
  return total.value > 0 ? ((count / total.value) * 100).toFixed(1) : '0.0';
};

// 生成饼图路径
const pieSegments = computed(() => {
  let currentAngle = 0;
  const radius = 100;
  const centerX = 120;
  const centerY = 120;

  return chartData.value.map((item) => {
    const percentage = item.count / total.value;
    const angle = percentage * 360;

    // 计算路径
    const startAngle = currentAngle * (Math.PI / 180);
    const endAngle = (currentAngle + angle) * (Math.PI / 180);

    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const path = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

    currentAngle += angle;

    return {
      ...item,
      path,
      percentage: (percentage * 100).toFixed(1),
    };
  });
});</script>

<template>
  <div class="pie-chart">
    <div class="chart-header">
      <h3 class="chart-title">项目活跃度分布</h3>
      <span class="chart-total">总计 {{ total }} 条</span>
    </div>

    <div v-if="chartData.length === 0" class="empty-state">
      <div class="empty-icon">📊</div>
      <p class="empty-text">暂无数据</p>
    </div>

    <div v-else class="chart-container">
      <svg viewBox="0 0 240 240" class="pie-svg">
        <!-- 饼图扇区 -->
        <g v-for="(segment, index) in pieSegments" :key="index"
           class="pie-segment"
           :style="{ '--segment-color': segment.color }">
          <path :d="segment.path" :fill="segment.color" />
        </g>

        <!-- 中心圆（实现环形图效果） -->
        <circle cx="120" cy="120" r="60" fill="var(--bg-secondary)" />
      </svg>

      <!-- 图例 -->
      <div class="legend">
        <div v-for="(item, index) in chartData" :key="index" class="legend-item">
          <span class="legend-dot" :style="{ background: item.color }"></span>
          <span class="legend-name">{{ item.name }}</span>
          <span class="legend-count">{{ item.count }}</span>
          <span class="legend-percent">{{ getPercentage(item.count) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pie-chart {
  padding: 24px;
  background: var(--card-bg-glass);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
  animation: slideFadeIn 0.5s ease-out forwards;
}

.pie-chart::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent-color), var(--secondary-accent), var(--accent-color));
  animation: borderScan 4s linear infinite;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
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

.chart-total {
  font-size: 14px;
  color: var(--text-muted);
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
  display: flex;
  align-items: center;
  gap: 40px;
}

.pie-svg {
  width: 240px;
  height: 240px;
  flex-shrink: 0;
  filter: drop-shadow(0 0 15px rgba(0, 212, 255, 0.2));
}

.pie-segment {
  cursor: pointer;
  transition: all 0.25s ease;
  stroke: rgba(0, 0, 0, 0.3);
  stroke-width: 1;
}

.pie-segment:hover {
  transform: scale(1.08);
  filter: brightness(1.3) drop-shadow(0 0 10px currentColor);
}

.legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: all 0.2s ease;
  background: var(--bg-primary);
}

.legend-item:hover {
  background: var(--hover-bg);
  border-color: var(--accent-color);
  box-shadow: 0 0 15px rgba(0, 212, 255, 0.15);
  transform: translateX(4px);
}

.legend-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor;
}

.legend-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.legend-count {
  font-size: 13px;
  color: var(--accent-color);
  font-weight: 600;
  font-family: var(--font-display);
  min-width: 50px;
  text-align: right;
  text-shadow: 0 0 5px rgba(0, 212, 255, 0.3);
}

.legend-percent {
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  min-width: 45px;
  text-align: right;
}
</style>
