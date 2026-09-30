<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef } from 'vue';
import type { Markmap } from 'markmap-view';

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

const wrapperRef = shallowRef<HTMLDivElement>();
const svgRef = shallowRef<SVGSVGElement>();
const failed = shallowRef(false);
const measuredHeight = shallowRef<number>();
const measuredWidth = shallowRef<number>();

let markmap: Markmap | undefined;
let renderedWidth = 0;
let rendering = false;
let visibilityObserver: IntersectionObserver | undefined;
let resizeObserver: ResizeObserver | undefined;
let resizeTimer: ReturnType<typeof setTimeout> | undefined;

const svgStyle = computed(() => ({
  height: `${measuredHeight.value ?? Math.max(320, (props.leaves ?? 10) * 28 + 40)}px`,
  width: measuredWidth.value ? `${measuredWidth.value}px` : '100%'
}));

const render = async () => {
  const wrapper = wrapperRef.value;
  const svg = svgRef.value;
  const availableWidth = wrapper?.clientWidth ?? 0;
  // 容器不可见或宽度未变化时不重复排版
  if (!wrapper || !svg || availableWidth === 0 || availableWidth === renderedWidth || rendering) return;
  rendering = true;
  try {
    if (!markmap) {
      // 只在导图进入视口时下载 markmap-view（含 d3），其余页面和未滚动到的位置不承担这部分体积
      const { Markmap } = await import('markmap-view');
      markmap = new Markmap(svg, {
        autoFit: false,
        // 关闭滚轮缩放与拖拽，避免在长文中劫持页面滚动；点击节点仍可折叠
        zoom: false,
        pan: false,
        maxInitialScale: 1,
        paddingX: 8,
        spacingVertical: 8,
        spacingHorizontal: 36,
        maxWidth: 300
      });
    }

    // 先恢复满宽再测量，避免沿用上一次窄屏时撑开的画布宽度
    measuredWidth.value = undefined;
    await nextTick();
    markmap.setOptions({ duration: 0 });
    await markmap.setData(JSON.parse(decodeURIComponent(props.data)));

    const { x1, x2, y1, y2 } = markmap.state.rect;
    const contentWidth = x2 - x1;
    // 渲染时节点尚未完成布局（尺寸为 0）则不定稿，等下一次尺寸变化回调再算
    if (contentWidth <= 0) return;

    // 宽度放得下就 1:1 显示，放不下才等比缩小；低于 MIN_SCALE 时改为横向滚动
    const fitScale = (availableWidth - PADDING_X * 2) / contentWidth;
    const scale = Math.min(1, Math.max(MIN_SCALE, fitScale));
    measuredWidth.value = fitScale < MIN_SCALE ? Math.ceil(contentWidth * scale + PADDING_X * 2) : undefined;
    measuredHeight.value = Math.ceil((y2 - y1) * scale + PADDING_Y * 2);
    await nextTick();
    await markmap.fit();
    markmap.setOptions({ duration: 300 });
    renderedWidth = availableWidth;
  } catch (error) {
    failed.value = true;
    console.error('[MarkmapDiagram] 渲染失败', error);
  } finally {
    rendering = false;
  }
};

onMounted(() => {
  const wrapper = wrapperRef.value;
  if (!wrapper) return;

  visibilityObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      visibilityObserver?.disconnect();
      void render();
    },
    { rootMargin: '300px 0px' }
  );
  visibilityObserver.observe(wrapper);

  // 横竖屏切换、窗口缩放后重新计算缩放比例和画布高度
  resizeObserver = new ResizeObserver(() => {
    if (!markmap) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => void render(), 150);
  });
  resizeObserver.observe(wrapper);
});

onBeforeUnmount(() => {
  visibilityObserver?.disconnect();
  resizeObserver?.disconnect();
  clearTimeout(resizeTimer);
  markmap?.destroy();
});
</script>

<template>
  <div ref="wrapperRef" class="markmap-diagram">
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
