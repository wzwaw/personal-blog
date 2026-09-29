<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue';

interface Props {
  /** 构建期由 markmap-lib 转换得到的节点树，经 encodeURIComponent 编码后传入 */
  data: string;
  /** 叶子节点数，只用于首屏占位高度，渲染后按实际内容重新计算 */
  leaves?: number;
}

const props = defineProps<Props>();

/** 画布上下、左右留白 */
const PADDING_Y = 24;
const PADDING_X = 12;
/** 窄屏下最多缩到这个比例，再窄就横向滚动，保证文字可读 */
const MIN_SCALE = 0.75;

const svgRef = shallowRef<SVGSVGElement>();
const failed = shallowRef(false);
const measuredHeight = shallowRef<number>();
const measuredWidth = shallowRef<number>();
let markmap: { destroy: () => void } | undefined;

const svgStyle = computed(() => ({
  height: `${measuredHeight.value ?? Math.max(320, (props.leaves ?? 10) * 28 + 40)}px`,
  width: measuredWidth.value ? `${measuredWidth.value}px` : '100%'
}));

onMounted(async () => {
  const svg = svgRef.value;
  if (!svg) return;
  try {
    // 只在出现导图的页面下载 markmap-view（含 d3），其余页面不承担这部分体积
    const { Markmap } = await import('markmap-view');
    const instance = new Markmap(svg, {
      autoFit: false,
      // 关闭滚轮缩放与拖拽，避免在长文中劫持页面滚动；点击节点仍可折叠
      zoom: false,
      pan: false,
      maxInitialScale: 1,
      duration: 0,
      paddingX: 8,
      spacingVertical: 8,
      spacingHorizontal: 36,
      maxWidth: 300
    });
    markmap = instance;
    await instance.setData(JSON.parse(decodeURIComponent(props.data)));

    // 按内容实际尺寸定画布：宽度放得下就 1:1 显示，放不下才等比缩小，避免估高不准导致整图被压小
    const { x1, x2, y1, y2 } = instance.state.rect;
    const contentWidth = x2 - x1;
    const fitScale = (svg.clientWidth - PADDING_X * 2) / contentWidth;
    const scale = Math.min(1, Math.max(MIN_SCALE, fitScale));
    if (fitScale < MIN_SCALE) {
      measuredWidth.value = Math.ceil(contentWidth * scale + PADDING_X * 2);
    }
    measuredHeight.value = Math.ceil((y2 - y1) * scale + PADDING_Y * 2);
    requestAnimationFrame(async () => {
      await instance.fit();
      instance.setOptions({ duration: 300 });
    });
  } catch (error) {
    failed.value = true;
    console.error('[MarkmapDiagram] 渲染失败', error);
  }
});

onBeforeUnmount(() => {
  markmap?.destroy();
});
</script>

<template>
  <div class="markmap-diagram">
    <svg ref="svgRef" class="markmap markmap-diagram__svg" :style="svgStyle" />
    <p v-if="failed" class="markmap-diagram__error">思维导图加载失败，请刷新页面重试。</p>
  </div>
</template>

<style scoped>
.markmap-diagram {
  margin: 16px 0;
  overflow-x: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.markmap-diagram__svg {
  display: block;
  max-width: none;
}

.markmap-diagram__error {
  margin: 0;
  padding: 12px 16px;
  color: var(--vp-c-danger-1);
}
</style>
