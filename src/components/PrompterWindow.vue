<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { state, transformStyle } from '../store'

const emit = defineEmits<{ (e: 'stop'): void }>()

const viewportRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)

const chars = ref<{ i: number; c: string }[]>([])

// 滚动状态
const autoScroll = ref(0) // 自动滚动基准（固定速度累加 / 语音目标缓动）
const userOffset = ref(0) // 鼠标/触摸额外偏移，保持
const targetScroll = ref(0) // 语音模式目标位置
const spans = ref<HTMLElement[]>([])
let prevIdx = -1

// 监听脚本变化，重建字符与 span 缓存
watch(
  () => state.script,
  (val) => {
    chars.value = Array.from(val).map((c, i) => ({ i, c }))
    nextTick(collectSpans)
  },
  { immediate: true, flush: 'post' },
)

function collectSpans() {
  if (contentRef.value) {
    spans.value = Array.from(contentRef.value.querySelectorAll('span[data-i]'))
  }
  resetHighlight()
}

function resetHighlight() {
  spans.value.forEach((el) => el.classList.remove('spoken', 'current'))
  prevIdx = -1
}

function charIndexAt(y: number): number {
  const arr = spans.value
  if (!arr.length) return 0
  let lo = 0
  let hi = arr.length - 1
  let ans = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid].offsetTop <= y) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

function applyHighlight(newIdx: number) {
  const arr = spans.value
  if (!arr.length) return
  if (newIdx === prevIdx) return
  const lo = Math.max(0, Math.min(prevIdx, newIdx))
  const hi = Math.max(prevIdx, newIdx)
  for (let i = lo; i <= hi; i++) {
    const el = arr[i]
    if (!el) continue
    el.classList.toggle('spoken', i < newIdx)
    el.classList.toggle('current', i === newIdx)
  }
  prevIdx = newIdx
}

// 语音匹配位置变化时，更新目标滚动位置（居中）
watch(
  () => state.matchedNorm,
  () => {
    if (state.mode !== 'speech' || !viewportRef.value || !contentRef.value) return
    const ni = Math.min(state.matchedNorm, state.normInfo.normToOrig.length - 1)
    const orig = state.normInfo.normToOrig[Math.max(0, ni)] ?? 0
    const el = spans.value[orig]
    if (!el) return
    const vh = viewportRef.value.clientHeight
    targetScroll.value = Math.max(0, el.offsetTop - vh / 2 + el.offsetHeight / 2)
  },
)

// 开始/停止时重置滚动
watch(
  () => state.running,
  (running) => {
    if (running) {
      autoScroll.value = 0
      userOffset.value = 0
      targetScroll.value = 0
      resetHighlight()
      nextTick(collectSpans)
    }
  },
)

// ===== 动画循环 =====
let raf = 0
let last = performance.now()

function tick(now: number) {
  const dt = Math.min(64, now - last)
  last = now
  const vh = viewportRef.value?.clientHeight ?? 1
  const ch = contentRef.value?.scrollHeight ?? 0
  const max = Math.max(0, ch - vh)

  if (state.running && !state.paused) {
    if (state.mode === 'fixed') {
      autoScroll.value += (state.speed * dt) / 1000
    } else {
      const k = 1 - Math.exp(-dt / 120)
      autoScroll.value += (targetScroll.value - autoScroll.value) * k
    }
  }
  if (autoScroll.value > max) autoScroll.value = max
  if (autoScroll.value < 0) autoScroll.value = 0

  let total = autoScroll.value + userOffset.value
  if (total > max) total = max
  if (total < 0) total = 0

  if (contentRef.value) {
    contentRef.value.style.transform = `translateY(${-total}px)`
  }

  // 高亮当前位置
  let idx: number
  if (state.mode === 'speech') {
    const ni = Math.min(state.matchedNorm, state.normInfo.normToOrig.length - 1)
    idx = state.normInfo.normToOrig[Math.max(0, ni)] ?? 0
  } else {
    idx = charIndexAt(total + vh / 2)
  }
  applyHighlight(idx)

  raf = requestAnimationFrame(tick)
}

// ===== 鼠标滚轮 / 触摸额外滚动（偏移保持）=====
function onWheel(e: WheelEvent) {
  e.preventDefault()
  userOffset.value += e.deltaY
}

let touchStartY = 0
let touchStartOffset = 0
function onTouchStart(e: TouchEvent) {
  touchStartY = e.touches[0].clientY
  touchStartOffset = userOffset.value
}
function onTouchMove(e: TouchEvent) {
  e.preventDefault()
  userOffset.value = touchStartOffset + (touchStartY - e.touches[0].clientY)
}

// ===== 拖拽移动 / 缩放 =====
function startDrag(e: PointerEvent) {
  e.preventDefault()
  const sx = e.clientX
  const sy = e.clientY
  const ox = state.win.x
  const oy = state.win.y
  const move = (ev: PointerEvent) => {
    state.win.x = Math.max(0, ox + (ev.clientX - sx))
    state.win.y = Math.max(0, oy + (ev.clientY - sy))
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

function startResize(e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  const sx = e.clientX
  const sy = e.clientY
  const ow = state.win.w
  const oh = state.win.h
  const move = (ev: PointerEvent) => {
    state.win.w = Math.max(220, ow + (ev.clientX - sx))
    state.win.h = Math.max(140, oh + (ev.clientY - sy))
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    nextTick(collectSpans)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

onMounted(() => {
  nextTick(collectSpans)
  const vp = viewportRef.value!
  vp.addEventListener('wheel', onWheel, { passive: false })
  vp.addEventListener('touchstart', onTouchStart, { passive: false })
  vp.addEventListener('touchmove', onTouchMove, { passive: false })
  raf = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  const vp = viewportRef.value
  if (vp) {
    vp.removeEventListener('wheel', onWheel)
    vp.removeEventListener('touchstart', onTouchStart)
    vp.removeEventListener('touchmove', onTouchMove)
  }
})

function togglePause() {
  state.paused = !state.paused
}
function stop() {
  emit('stop')
}
</script>

<template>
  <div
    class="pw"
    :style="{
      left: state.win.x + 'px',
      top: state.win.y + 'px',
      width: state.win.w + 'px',
      height: state.win.h + 'px',
      background: state.background,
    }"
  >
    <div class="pw-header" @pointerdown="startDrag">
      <span class="pw-title">提词器</span>
      <div class="pw-ctrls">
        <button v-if="state.running" @pointerdown.stop @click="togglePause">
          {{ state.paused ? '继续' : '暂停' }}
        </button>
        <button v-if="state.running" @pointerdown.stop @click="stop">停止</button>
      </div>
    </div>

    <div class="pw-viewport" ref="viewportRef">
      <div class="pw-stage" :style="{ transform: transformStyle() }">
        <div
          class="pw-content"
          ref="contentRef"
          :style="{
            color: state.color,
            fontSize: state.fontSize + 'px',
            fontFamily: state.fontFamily,
            lineHeight: state.lineHeight,
          }"
        >
          <span v-for="ch in chars" :key="ch.i" :data-i="ch.i">{{ ch.c }}</span>
        </div>
      </div>
      <div v-if="state.mode === 'speech' && state.interimText" class="pw-interim">
        {{ state.interimText }}
      </div>
    </div>

    <div class="pw-resize" @pointerdown="startResize" title="拖拽缩放"></div>
  </div>
</template>

<style scoped>
.pw {
  position: absolute;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.12);
  user-select: none;
}
.pw-header {
  height: 36px;
  flex: 0 0 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.08);
  cursor: move;
  touch-action: none;
}
.pw-title {
  font-size: 13px;
  color: #cdd3df;
}
.pw-ctrls {
  display: flex;
  gap: 6px;
}
.pw-ctrls button {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: #e6e9ef;
  cursor: pointer;
}
.pw-viewport {
  position: relative;
  flex: 1 1 auto;
  overflow: hidden;
  touch-action: none;
}
.pw-stage {
  width: 100%;
  height: 100%;
  transform-origin: center center;
}
.pw-content {
  position: relative;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 12px 16px;
  will-change: transform;
  min-height: 100%;
}
.pw-content span.spoken {
  opacity: 0.35;
}
.pw-content span.current {
  background: rgba(255, 213, 79, 0.35);
  border-radius: 3px;
  opacity: 1;
}
.pw-interim {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 6px 12px;
  font-size: 13px;
  color: #ffd54f;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none;
}
.pw-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18px;
  height: 18px;
  cursor: nwse-resize;
  background: linear-gradient(135deg, transparent 50%, rgba(255, 255, 255, 0.5) 50%);
  touch-action: none;
}
</style>
