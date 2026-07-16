<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { state, transformStyle } from '../store'
import { t } from '../i18n'

const emit = defineEmits<{ (e: 'stop'): void }>()

const rootRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)

// 窗口模式：浮窗按比例/坐标；窗口全屏与屏幕全屏填满父容器
const pwStyle = computed(() => {
  if (state.windowMode === 'float') {
    return {
      left: state.win.x + 'px',
      top: state.win.y + 'px',
      width: state.win.w + 'px',
      height: state.win.h + 'px',
    }
  }
  return { left: '0', top: '0', width: '100%', height: '100%' }
})
const pwClass = computed(() => 'pw mode-' + state.windowMode)

const chars = ref<{ i: number; c: string }[]>([])

// 滚动状态
const autoScroll = ref(0) // 自动滚动基准（固定速度累加 / 语音目标缓动）
const userOffset = ref(0) // 鼠标/触摸额外偏移，保持
const userOffsetTarget = ref(0) // 偏移目标值，滚轮缓动逼近它
const targetScroll = ref(0) // 语音模式目标位置
const spans = ref<HTMLElement[]>([])
let prevIdx = -1

// 单次滚轮最多移动像素（可在设置中调整），避免一滚就飞很远找不到位置
function wheelStep(): number {
  return Math.max(1, state.wheelStep || 80)
}

// 滚动范围：围绕朗读线对称，保证首尾文字都能越过朗读线
// 下限为负：内容顶部可滚到朗读线下方（首行文字完全到线下面）
// 上限超过内容底部：内容底部可滚到朗读线上方（尾行文字完全过线才结束）
function scrollBounds() {
  const vh = viewportRef.value?.clientHeight ?? 0
  const ch = contentRef.value?.scrollHeight ?? 0
  const lineY = vh * state.readLine
  const min = -lineY
  const max = Math.max(min, ch - lineY)
  return { min, max }
}

// 内容边界外再允许额外滚动一点，避免“滚到开始/结束位置后无法继续反向滚动”的死区
// （lo/hi 是用户可滚动的总位置范围，autoScroll 仍被限制在 [min, max] 内，不会自动滚进空白区）
function relaxedBounds() {
  const { min, max } = scrollBounds()
  const vh = viewportRef.value?.clientHeight ?? 0
  const overscroll = Math.max(80, vh * 0.5)
  return { min, max, lo: min - overscroll, hi: max + overscroll }
}

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
    if (arr[mid]!.offsetTop <= y) {
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

// 语音匹配位置变化时，更新目标滚动位置（对齐到朗读线）
watch(
  () => state.matchedNorm,
  () => {
    if (state.mode !== 'speech' || !viewportRef.value || !contentRef.value) return
    const ni = Math.min(state.matchedNorm, state.normInfo.normToOrig.length - 1)
    const orig = state.normInfo.normToOrig[Math.max(0, ni)] ?? 0
    const el = spans.value[orig]
    if (!el) return
    const { min, max } = scrollBounds()
    const lineY = viewportRef.value.clientHeight * state.readLine
    targetScroll.value = Math.min(max, Math.max(min, el.offsetTop - lineY + el.offsetHeight / 2))
  },
)

// 开始/停止时重置滚动
watch(
  () => state.running,
  (running) => {
    if (running) {
      userOffset.value = 0
      userOffsetTarget.value = 0
      targetScroll.value = 0
      resetHighlight()
      // 从朗读线下方开始：自动滚动基准设为下限，使首行文字初始就在朗读线之下
      nextTick(() => {
        collectSpans()
        autoScroll.value = scrollBounds().min
      })
    } else {
      // 停止后归零，便于未开始时手动浏览也能滚到朗读线上下两端
      autoScroll.value = 0
      userOffset.value = 0
      userOffsetTarget.value = 0
      targetScroll.value = 0
    }
  },
)

// ===== 动画循环 =====
let raf = 0
let last = performance.now()

function tick(now: number) {
  const dt = Math.min(64, now - last)
  last = now
  const { min, max } = scrollBounds()
  const vh = viewportRef.value?.clientHeight ?? 1

  if (state.running && !state.paused) {
    if (state.mode === 'fixed') {
      autoScroll.value += (state.speed * dt) / 1000
    } else {
      const k = 1 - Math.exp(-dt / 120)
      autoScroll.value += (targetScroll.value - autoScroll.value) * k
    }
  }
  if (autoScroll.value > max) autoScroll.value = max
  if (autoScroll.value < min) autoScroll.value = min

  // 鼠标/触摸偏移缓动逼近目标值（不直接跳变）
  const ke = 1 - Math.exp(-dt / 140)
  userOffset.value += (userOffsetTarget.value - userOffset.value) * ke
  // 相对自动滚动位置限制偏移，使总位置落在 [lo, hi]：
  // 避免把相对偏移错当成绝对位置来裁剪而产生“滚轮有增益但画面不动”的死区
  const { lo, hi } = relaxedBounds()
  const loU = lo - autoScroll.value
  const hiU = hi - autoScroll.value
  if (userOffset.value > hiU) userOffset.value = hiU
  if (userOffset.value < loU) userOffset.value = loU

  let total = autoScroll.value + userOffset.value
  if (total > hi) total = hi
  if (total < lo) total = lo

  if (contentRef.value) {
    contentRef.value.style.transform = `translateY(${-total}px)`
  }

  // 高亮当前位置
  let idx: number
  if (state.mode === 'speech') {
    const ni = Math.min(state.matchedNorm, state.normInfo.normToOrig.length - 1)
    idx = state.normInfo.normToOrig[Math.max(0, ni)] ?? 0
  } else {
    const lineY = vh * state.readLine
    idx = charIndexAt(total + lineY)
  }
  applyHighlight(idx)

  raf = requestAnimationFrame(tick)
}

// ===== 鼠标滚轮 / 触摸额外滚动（偏移保持，未开始时也可滚动浏览）=====
function clampOffsetTarget() {
  const { lo, hi } = relaxedBounds()
  const loU = lo - autoScroll.value
  const hiU = hi - autoScroll.value
  if (userOffsetTarget.value > hiU) userOffsetTarget.value = hiU
  if (userOffsetTarget.value < loU) userOffsetTarget.value = loU
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  // 归一化不同 deltaMode 的滚动量（像素/行/页），否则 Firefox 等按“行”返回的滚轮
  // deltaY 只有个位数，乘以 wheelStep 截断后几乎不动，表现为“增益没反应”
  let d = e.deltaY
  if (e.deltaMode === 1) {
    d *= Math.max(16, state.fontSize * state.lineHeight)
  } else if (e.deltaMode === 2) {
    d *= viewportRef.value?.clientHeight ?? 800
  }
  // 限制单次位移，并累加到目标值由动画循环缓动逼近
  const step = wheelStep()
  d = Math.max(-step, Math.min(step, d))
  userOffsetTarget.value += d
  clampOffsetTarget()
}

let touchStartY = 0
let touchStartOffset = 0
function onTouchStart(e: TouchEvent) {
  touchStartY = e.touches[0]!.clientY
  touchStartOffset = userOffset.value
}
function onTouchMove(e: TouchEvent) {
  e.preventDefault()
  // 触摸为直接拖拽，立即跟随（目标与当前同步，缓动无副作用）
  const val = touchStartOffset + (touchStartY - e.touches[0]!.clientY)
  userOffset.value = val
  userOffsetTarget.value = val
  clampOffsetTarget()
}

// 将屏幕坐标反变换到 stage 本地坐标（抵消旋转/翻转），使朗读线拖拽在任意变换下都正确
function localFromClient(clientX: number, clientY: number) {
  const vp = viewportRef.value!
  const rect = vp.getBoundingClientRect()
  const gx = clientX - rect.left
  const gy = clientY - rect.top
  const W = rect.width
  const H = rect.height
  const m = new DOMMatrix()
  if (state.flipH) m.scaleSelf(-1, 1)
  if (state.flipV) m.scaleSelf(1, -1)
  m.rotateSelf(state.rotation)
  const cx = W / 2
  const cy = H / 2
  const full = new DOMMatrix()
    .translate(cx, cy)
    .multiply(m)
    .multiply(new DOMMatrix().translate(-cx, -cy))
  const p = full.inverse().transformPoint(new DOMPoint(gx, gy))
  return { y: p.y, h: H }
}

// 拖拽朗读线调整其位置（视口高度比例）
function startDragReadLine(e: PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  const move = (ev: PointerEvent) => {
    const loc = localFromClient(ev.clientX, ev.clientY)
    if (loc.h > 0) {
      state.readLine = Math.max(0.05, Math.min(0.95, loc.y / loc.h))
    }
  }
  move(e)
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

// ===== 拖拽移动 / 缩放 =====
function startDrag(e: PointerEvent) {
  if (state.windowMode !== 'float') return
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

// 屏幕全屏：进入时请求真实全屏，退出时回到窗口模式
function syncFullscreen() {
  if (typeof document === 'undefined') return
  if (state.windowMode === 'screen') {
    const el = rootRef.value
    if (el && !document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {})
    }
  } else if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {})
  }
}
watch(() => state.windowMode, syncFullscreen)

onMounted(() => {
  nextTick(collectSpans)
  syncFullscreen()
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && state.windowMode === 'screen') {
      state.windowMode = 'window'
    }
  })
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
    ref="rootRef"
    :class="pwClass"
    :style="{ ...pwStyle, background: state.background }"
  >
    <div class="pw-header" @pointerdown="startDrag">
      <span class="pw-title">{{ t('prompter.title') }}</span>
      <div v-if="state.windowMode === 'float'" class="pw-drag-handle" @pointerdown="startDrag" :title="t('prompter.dragHandle')"></div>
      <div class="pw-ctrls">
        <button v-if="state.running" @pointerdown.stop @click="togglePause">
          {{ state.paused ? t('action.resume') : t('action.pause') }}
        </button>
        <button v-if="state.running" @pointerdown.stop @click="stop">{{ t('action.stop') }}</button>
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
            // 始终防止超长单词溢出浮窗：必要时才断词
            overflowWrap: 'break-word',
            // 勾选时在行尾把英文单词拆开放两行（break-all 在逐字 span 结构下也能稳定断词）
            wordBreak: state.breakWords ? 'break-all' : 'normal',
          }"
        >
          <span v-for="ch in chars" :key="ch.i" :data-i="ch.i">{{ ch.c }}</span>
        </div>
        <div
          class="pw-readline"
          :style="{ top: state.readLine * 100 + '%' }"
          @pointerdown="startDragReadLine"
          :title="t('prompter.readLineGrip')"
        >
          <span class="pw-readline-grip"></span>
        </div>
      </div>
      <div v-if="state.mode === 'speech' && state.interimText" class="pw-interim">
        {{ state.interimText }}
      </div>
    </div>

    <div v-if="state.windowMode === 'float'" class="pw-resize" @pointerdown="startResize" :title="t('prompter.resize')"></div>
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
.pw.mode-window,
.pw.mode-screen {
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  border-radius: 0;
  border: none;
  box-shadow: none;
}
.pw.mode-screen {
  position: fixed;
  z-index: 9999;
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
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: center center;
}
.pw-content {
  position: relative;
  white-space: pre-wrap;
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
.pw-readline {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 2px solid rgba(255, 213, 79, 0.85);
  pointer-events: none;
  z-index: 5;
}
.pw-readline-grip {
  position: absolute;
  right: 10px;
  top: -7px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ffd54f;
  pointer-events: auto;
  cursor: ns-resize;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.5);
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
.pw-drag-handle {
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 56px;
  height: 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.22);
  cursor: move;
  touch-action: none;
  z-index: 6;
  transition: background 0.15s ease;
}
.pw-header:hover .pw-drag-handle {
  background: rgba(255, 255, 255, 0.4);
}
.pw-header:active .pw-drag-handle {
  background: rgba(255, 255, 255, 0.6);
}
</style>
