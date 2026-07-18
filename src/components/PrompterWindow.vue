<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { state, transformStyle, displayScript } from '../store'
import { t } from '../i18n'

const emit = defineEmits<{ (e: 'stop'): void }>()

const rootRef = ref<HTMLElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)

// Float-like modes (float / screen-float): the window is shown as a draggable floating window by coordinates/size.
// 浮窗类模式（float / screen-float）：窗口按坐标/尺寸作为可拖拽浮窗展示
const isFloatLike = computed(() => state.windowMode === 'float' || state.windowMode === 'screen-float')

// Window modes: float-like uses coordinates/size; window-fullscreen and screen-fullscreen fill the parent container.
// 窗口模式：浮窗类按坐标/尺寸；窗口全屏与屏幕全屏填满父容器
const pwStyle = computed(() => {
  if (isFloatLike.value) {
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

// Root container: in screen / screen-float mode it acts as the fullscreen background layer and the request target for real fullscreen;
// 根容器：screen / screen-float 模式下作为全屏背景层并作为真实全屏请求目标；
// in other modes it is just a static wrapper that does not interfere with the float's absolute positioning relative to .stage.
// 其余模式下仅为静态包裹，不干扰浮窗相对 .stage 的绝对定位
const rootClass = computed(() => {
  if (state.windowMode === 'screen' || state.windowMode === 'screen-float') return 'pw-root mode-' + state.windowMode
  return 'pw-root'
})
const rootStyle = computed(() => {
  // Fullscreen float: the root fills the screen and serves as a black background, with the inner float hovering above it.
  // 全屏浮窗：根容器铺满全屏并作为黑底背景，内部浮窗悬浮其上
  if (state.windowMode === 'screen-float') return { background: state.background }
  return {}
})

const chars = ref<{ i: number; c: string }[]>([])

// Scroll state.
// 滚动状态
const autoScroll = ref(0) // Auto-scroll base (fixed-speed accumulation / speech-target easing). / 自动滚动基准（固定速度累加 / 语音目标缓动）
const userOffset = ref(0) // Extra offset from mouse/touch, held. / 鼠标/触摸额外偏移，保持
const userOffsetTarget = ref(0) // Offset target value, approached by wheel easing. / 偏移目标值，滚轮缓动逼近它
const targetScroll = ref(0) // Speech-mode target position. / 语音模式目标位置
const spans = ref<HTMLElement[]>([])
let prevIdx = -1

// Max pixels moved per single wheel notch (adjustable in settings), so one notch does not fly far away and lose the position.
// 单次滚轮最多移动像素（可在设置中调整），避免一滚就飞很远找不到位置
function wheelStep(): number {
  return Math.max(1, state.wheelStep || 80)
}

// Scroll range: symmetric around the read line, so both the first and last lines can cross it.
// 滚动范围：围绕朗读线对称，保证首尾文字都能越过朗读线
// Lower bound is negative: the content top can scroll below the read line (first line fully beneath it).
// 下限为负：内容顶部可滚到朗读线下方（首行文字完全到线下面）。
// Upper bound exceeds the content bottom: the content bottom can scroll above the read line (last line only ends after fully crossing).
// 上限超过内容底部：内容底部可滚到朗读线上方（尾行文字完全过线才结束）。
function scrollBounds() {
  const vh = viewportRef.value?.clientHeight ?? 0
  const ch = contentRef.value?.scrollHeight ?? 0
  const lineY = vh * state.readLine
  const min = -lineY
  const max = Math.max(min, ch - lineY)
  return { min, max }
}

// Allow a little extra scrolling beyond the content bounds, to avoid a dead zone where "after scrolling to start/end you cannot keep scrolling the other way".
// 内容边界外再允许额外滚动一点，避免“滚到开始/结束位置后无法继续反向滚动”的死区
// (lo/hi are the total user-scrollable position range; autoScroll stays within [min, max] and never auto-scrolls into the blank area.)
// （lo/hi 是用户可滚动的总位置范围，autoScroll 仍被限制在 [min, max] 内，不会自动滚进空白区）
function relaxedBounds() {
  const { min, max } = scrollBounds()
  const vh = viewportRef.value?.clientHeight ?? 0
  const overscroll = Math.max(80, vh * 0.5)
  return { min, max, lo: min - overscroll, hi: max + overscroll }
}

// Watch script changes (including the "remove blank lines" toggle) and rebuild the character and span caches.
// 监听脚本变化（含“移除连续空白行”开关），重建字符与 span 缓存
watch(
  () => displayScript.value,
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

// When the speech-matched position changes, update the target scroll position (aligned to the read line).
// 语音匹配位置变化时，更新目标滚动位置（对齐到朗读线）。
// Use the live-preview position liveNorm so scrolling follows during speaking, instead of waiting for a sentence's final.
// 使用实时预览位置 liveNorm，使滚动在说话过程中就跟随，而非等一句话 final 才跟上
watch(
  () => state.liveNorm,
  () => {
    if (state.mode !== 'speech' || !viewportRef.value || !contentRef.value) return
    const ni = Math.min(state.liveNorm, state.normInfo.normToOrig.length - 1)
    const orig = state.normInfo.normToOrig[Math.max(0, ni)] ?? 0
    const el = spans.value[orig]
    if (!el) return
    const { min, max } = scrollBounds()
    const lineY = viewportRef.value.clientHeight * state.readLine
    targetScroll.value = Math.min(max, Math.max(min, el.offsetTop - lineY + el.offsetHeight / 2))
    console.log('[SCROLL:targetScroll] liveNorm=%d orig=%d el.offsetTop=%d targetScroll=%d (bounds=[%d,%d])', state.liveNorm, orig, el.offsetTop, targetScroll.value, min, max)
  },
)

// Reset scrolling on start/stop.
// 开始/停止时重置滚动
watch(
  () => state.running,
  (running) => {
    if (running) {
      userOffset.value = 0
      userOffsetTarget.value = 0
      targetScroll.value = 0
      resetHighlight()
      // Start below the read line: set the auto-scroll base to the lower bound so the first line begins beneath the read line.
      // 从朗读线下方开始：自动滚动基准设为下限，使首行文字初始就在朗读线之下
      nextTick(() => {
        collectSpans()
        autoScroll.value = scrollBounds().min
      })
    } else {
      // After stopping, return to the initial position with "first line below the read line", consistent with the static state right after load,
      // 停止后回到「首行在朗读线下方」的初始位置，与刚加载完时的静止态一致，
      // so manual browsing before starting also begins near the read line and scrolls downward.
      // 便于未开始时手动浏览也能从朗读线附近开始向下阅读
      autoScroll.value = scrollBounds().min
      userOffset.value = 0
      userOffsetTarget.value = 0
      targetScroll.value = 0
    }
  },
)

// ===== Animation loop =====
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

  // Mouse/touch offset eases toward its target (no abrupt jump).
  // 鼠标/触摸偏移缓动逼近目标值（不直接跳变）
  const ke = 1 - Math.exp(-dt / 140)
  userOffset.value += (userOffsetTarget.value - userOffset.value) * ke
  // Limit the offset relative to the auto-scroll position so the total stays within [lo, hi]:
  // 相对自动滚动位置限制偏移，使总位置落在 [lo, hi]：
  // avoids treating the relative offset as an absolute position when clipping, which would create a dead zone where "the wheel gains but the view does not move".
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

  // Highlight the current position.
  // 高亮当前位置
  let idx: number
  if (state.mode === 'speech') {
    const ni = Math.min(state.liveNorm, state.normInfo.normToOrig.length - 1)
    idx = state.normInfo.normToOrig[Math.max(0, ni)] ?? 0
  } else {
    const lineY = vh * state.readLine
    idx = charIndexAt(total + lineY)
  }
  applyHighlight(idx)

  raf = requestAnimationFrame(tick)
}

// ===== Mouse wheel / touch extra scrolling (offset held, browsable even before starting) =====
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
  // Normalize scroll amounts across different deltaModes (pixel/line/page); otherwise wheels returning "line" in Firefox etc.
  // 归一化不同 deltaMode 的滚动量（像素/行/页），否则 Firefox 等按“行”返回的滚轮
  // have a single-digit deltaY that, after multiplying by wheelStep and truncating, barely moves and looks like "no gain response".
  // deltaY 只有个位数，乘以 wheelStep 截断后几乎不动，表现为“增益没反应”。
  let d = e.deltaY
  if (e.deltaMode === 1) {
    d *= Math.max(16, state.fontSize * state.lineHeight)
  } else if (e.deltaMode === 2) {
    d *= viewportRef.value?.clientHeight ?? 800
  }
  // Limit the single move and accumulate into the target, approached by the animation loop's easing.
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
  // Touch is a direct drag, followed immediately (target synced with current, easing has no side effect).
  // 触摸为直接拖拽，立即跟随（目标与当前同步，缓动无副作用）
  const val = touchStartOffset + (touchStartY - e.touches[0]!.clientY)
  userOffset.value = val
  userOffsetTarget.value = val
  clampOffsetTarget()
}

// Inverse-transform screen coordinates back to stage-local coordinates (canceling rotation/flip), so read-line dragging is correct under any transform.
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

// Drag the read line to adjust its position (ratio of viewport height).
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

// ===== Drag to move / resize =====
// ===== 拖拽移动 / 缩放 =====
function startDrag(e: PointerEvent) {
  if (!isFloatLike.value) return
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

// Screen fullscreen / fullscreen float: request real fullscreen on enter, return to the corresponding non-fullscreen mode on exit.
// 屏幕全屏 / 全屏浮窗：进入时请求真实全屏，退出时回到对应非全屏模式
function syncFullscreen() {
  if (typeof document === 'undefined') return
  if (state.windowMode === 'screen' || state.windowMode === 'screen-float') {
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
  // Initial static state: place the first line below the read line (base set to the lower bound),
  // 初始静止态：将首行文案定位到朗读线下方（基准设为下限），
  // rather than at the float's top, so text is not jammed against the very top of the window right after load.
  // 而非浮窗顶部，避免页面刚加载完时文字顶在窗口最上方
  autoScroll.value = scrollBounds().min
  nextTick(collectSpans)
  syncFullscreen()
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      if (state.windowMode === 'screen') state.windowMode = 'window'
      else if (state.windowMode === 'screen-float') state.windowMode = 'float'
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
  <div ref="rootRef" :class="rootClass" :style="rootStyle">
    <div
      :class="pwClass"
      :style="{ ...pwStyle, background: state.background }"
    >
      <div class="pw-header" @pointerdown="startDrag">
        <span class="pw-title">{{ t('prompter.title') }}</span>
        <div v-if="isFloatLike" class="pw-drag-handle" @pointerdown="startDrag" :title="t('prompter.dragHandle')"></div>
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
            letterSpacing: state.letterSpacing + 'px',
            // Always prevent very long words from overflowing the float: break only when necessary.
            // 始终防止超长单词溢出浮窗：必要时才断词
            overflowWrap: 'break-word',
            // When checked, break English words across lines at the line end (break-all also breaks reliably under the per-char span structure).
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

      <div v-if="isFloatLike" class="pw-resize" @pointerdown="startResize" :title="t('prompter.resize')"></div>
    </div>
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
/* Root container: in screen-fullscreen / fullscreen-float mode it acts as the fullscreen background layer and the request target for real fullscreen. */
/* 根容器：屏幕全屏 / 全屏浮窗模式下作为全屏背景层，并作为真实全屏请求目标 */
.pw-root.mode-screen,
.pw-root.mode-screen-float {
  position: fixed;
  inset: 0;
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
