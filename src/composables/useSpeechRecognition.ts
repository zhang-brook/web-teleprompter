import { ref, onUnmounted } from 'vue'
import { t } from '../i18n'

// Minimal type declarations for the Web Speech API (not included in the standard lib).
// Web Speech API 最小类型声明（标准 lib 未包含）。
interface SpeechRecognitionResultLike {
  0: { transcript: string }
  isFinal: boolean
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: SpeechRecognitionResultLike[]
}
interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onstart: (() => void) | null
  onend: (() => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
}

export function useSpeechRecognition() {
  const supported =
    typeof window !== 'undefined' && !!(
      window.SpeechRecognition || window.webkitSpeechRecognition)

  const listening = ref(false)
  const loading = ref(false)
  const error = ref('')
  const interimText = ref('')
  const available = ref(supported)

  // Detect mobile (Android/iOS). On Android Chrome the Web Speech API does NOT honor `continuous`,
  // 检测移动端（安卓/iOS）。安卓 Chrome 上 Web Speech API 不支持 `continuous`，
  // so every session ends after a short utterance/silence and must be restarted to keep following.
  // 因此每段识别遇静音/气口就会结束，需要重启才能继续跟随。
  const isMobile =
    typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)

  let rec: SpeechRecognitionLike | null = null
  let onTextCb: ((text: string) => void) | null = null
  let onLiveCb: ((text: string) => void) | null = null
  let restartTimer: number | null = null
  let loadStart = 0 // Timestamp when loading started (used to guarantee a minimum display duration). / 开始加载的时间戳（用于保证最短展示时长）
  let minLoadTimer: number | null = null // Timer that guarantees the minimum loading display duration. / 保证最短展示时长的定时器
  let incrementalAccum = '' // Cross-session buffer of "new final" text, fed back incrementally to the aligner (avoids re-sending the whole segment each time). / 跨会话累积的「新增 final」文本，作为增量回调给对齐逻辑（避免每次回传整段）
  let currentInterim = '' // Current interim text (display only, not used for alignment). / 当前 interim 文本（仅用于显示，不参与对齐）
  let sessionStart = 0 // Timestamp when the current recognition session started (used to detect spurious quick-ending sessions). / 当前识别会话的启动时间戳（用于识别“瞬间结束”的空转会话）
  let backoff = 0 // Consecutive count of quick-ending sessions; drives exponential backoff to break the mic-icon "crazy flashing" tight loop on Android. / 连续瞬间结束的次数，驱动指数退避以打破安卓上录音图标“狂闪”的紧循环

  const BASE_RESTART_DELAY = isMobile ? 350 : 80 // Base delay before restarting; mobile needs more time to release the mic engine. / 重启前的基础延迟；移动端需要更多时间释放麦克风引擎
  const QUICK_END_MS = 500 // A session shorter than this is treated as "did not really listen" (spurious). / 短于此时长的会话视为“没有真正在听”（空转）
  const MAX_RESTART_DELAY = 3000 // Upper bound of backoff delay. / 退避延迟上限

  // Fatal errors: never restart on these — they only produce endless flashing without ever working.
  // 致命错误：遇到这些绝不重启——重启只会无限狂闪且永远无法工作。
  const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture'])
  // Transient errors: expected during normal following (silence / auto session end); do not surface to the user.
  // 瞬时错误：正常跟随过程中会出现（静音 / 会话自动结束）；不应作为错误提示给用户。
  const TRANSIENT_ERRORS = new Set(['no-speech', 'aborted', 'network'])

  function clearRestart() {
    if (restartTimer !== null) {
      window.clearTimeout(restartTimer)
      restartTimer = null
    }
  }

  // Actually turn off the loading state and clear the related timers.
  // 真正关闭加载态，并清理相关定时器
  function hideLoading() {
    loading.value = false
    if (minLoadTimer !== null) {
      window.clearTimeout(minLoadTimer)
      minLoadTimer = null
    }
  }

  // End the loading state: if less than the minimum duration has elapsed since start, delay hiding until the minimum, so the user sees feedback.
  // 结束加载态：若距开始不足最短时长，则延迟到最短时长后再隐藏，确保用户能看到反馈
  function endLoading() {
    if (!loading.value) return
    const MIN = 600
    const elapsed = performance.now() - loadStart
    if (elapsed >= MIN) hideLoading()
    else minLoadTimer = window.setTimeout(() => { minLoadTimer = null; hideLoading() }, MIN - elapsed)
  }

  function start(cb: (text: string) => void, lang?: string, onLive?: (text: string) => void) {
    if (!supported) {
      error.value = t('speech.unsupported')
      return
    }
    onTextCb = cb
    onLiveCb = onLive ?? null
    clearRestart()
    const Ctor = (window.SpeechRecognition || window.webkitSpeechRecognition)!
    rec = new Ctor()
    // Android Chrome ignores `continuous` (it always ends after a single utterance). Setting it true there
    // 安卓 Chrome 会忽略 `continuous`（总是在一段话后结束）。在移动端设为 true
    // can also make sessions terminate immediately; keep the auto-restart loop drive continuity on mobile instead.
    // 反而可能让会话立即结束；移动端改由自动重启循环来维持连续性。
    rec.continuous = !isMobile // true
    rec.interimResults = true
    rec.lang = lang || 'zh-CN'
    backoff = 0

    rec.onstart = () => {
      console.log('[SR:onstart] recognition session started (fires on every restart)')
      // 识别会话已启动（每次重启都会触发）
      sessionStart = performance.now()
      // The recognition engine is truly ready; end the loading state.
      // 识别引擎真正就绪，结束加载态
      endLoading()
    }

    rec.onresult = (e: SpeechRecognitionEventLike) => {
      console.log('[SR:onresult] resultIndex=%d results.length=%d', e.resultIndex, e.results.length)
      // Incremental handling: only append the "new finals from this event" to the cross-session buffer and feed them back to the aligner.
      // 增量处理：只把「本次事件新增的 final」追加到跨会话缓冲，回传给对齐逻辑
      // The browser ends and restarts a session after silence/pauses, and results re-count from 0 after restart,
      // 浏览器会在静音/气口后结束会话并重启，重启后 results 从 0 重新计数，
      // so each onresult carries the "full text so far" — feeding the whole segment back would mean the longer one speaks, the longer the App re-aligns the whole O(M^2) segment each time.
      // 因此每次 onresult 都拿到“到目前为止的完整文本”——若回传整段，单会话内说话越久文本越长，App 端每次都要对整段做 O(M^2) 对齐，成本随时间膨胀
      // Instead: only finals from resultIndex onward are new (already-handled ones are not re-appended),
      // 这里改为：仅 resultIndex 起（含）的 final 才是新内容（之前已处理过的不再重复追加），
      // accumulate them cross-session into incrementalAccum and feed back the increment; interim is unstable and used for display only, not alignment.
      // 跨会话累积到 incrementalAccum，回传增量；interim 不稳定，仅用于显示、不参与对齐
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i]!
        const txt = res[0]!.transcript
        if (res.isFinal) {
          if (i >= e.resultIndex) incrementalAccum += txt
        } else {
          interim += txt
        }
      }
      if (incrementalAccum) {
        console.log('[SR:onresult] -> incremental final (cross-session accumulation) len=%d "%s"', incrementalAccum.length, incrementalAccum)
        onTextCb?.(incrementalAccum)
        incrementalAccum = ''
      }
      if (interim !== currentInterim) {
        currentInterim = interim
        interimText.value = interim
        // Live preview: feed the not-yet-confirmed interim text to the aligner as well,
        // 实时预览：把尚未确认的 interim 文本也交给对齐逻辑，
        // so the cursor follows along while speaking, instead of waiting for a whole sentence's final.
        // 让光标在说话过程中就跟着走，而不是等一句话 final 才跟上
        if (onLiveCb && interim) onLiveCb(interim)
      }
    }

    rec.onerror = (e: { error?: string }) => {
      console.log('[SR:onerror] error=%s', e.error)
      const err = e.error || 'speech-error'
      hideLoading()
      // Fatal errors (mic permission denied / capture failed): stop entirely. Restarting would only spawn an
      // 致命错误（麦克风权限被拒 / 采集失败）：直接彻底停止。继续重启只会形成
      // endless start→fail→restart loop, which is exactly what makes the tab's recording icon flash crazily on Android.
      // “启动→失败→重启”的死循环，也正是安卓上标签页录音图标狂闪的根源。
      if (FATAL_ERRORS.has(err)) {
        error.value = err === 'audio-capture' ? t('speech.audioCapture') : t('speech.micDenied')
        listening.value = false
        clearRestart()
        return
      }
      // Transient errors (no-speech / aborted / network) are normal during following; keep going without alarming the user.
      // 瞬时错误（no-speech / aborted / network）在跟随过程中很正常；继续运行且不打扰用户。
      if (!TRANSIENT_ERRORS.has(err)) {
        error.value = err
      }
    }

    rec.onend = () => {
      console.log('[SR:onend] listening=%s (restart delayed if true)', listening.value)
      // 若为 true 将延迟重启会话
      // Still speaking: the browser ends recognition after silence/pauses and must be restarted to keep following.
      // 仍在口播中：浏览器在静音/气口后会结束识别，需要重新启动才能继续跟随
      // Key: synchronously calling start inside onend throws InvalidStateError in Chrome, which is swallowed by the catch and would terminate recognition for good.
      // 关键：在 onend 内【同步】调用 start 在 Chrome 中会抛 InvalidStateError，被 catch 吞掉后识别会彻底终止、之后不再跟随
      // So delay the restart to the next event loop.
      // 故延迟到下一轮事件循环再启动
      if (listening.value && rec) {
        // If the session ended almost immediately, it likely never really listened (common on Android when the mic
        // 若会话几乎瞬间结束，很可能根本没有真正在听（安卓上麦克风尚未就绪或引擎繁忙时常见），
        // engine is busy / not ready). Back off exponentially so we don't hammer start() and cause the icon to flash crazily.
        // 此时指数退避，避免疯狂调用 start() 导致录音图标狂闪。
        const sessionDur = performance.now() - sessionStart
        if (sessionDur < QUICK_END_MS) backoff++
        else backoff = 0
        const delay =
          backoff > 0
            ? Math.min(BASE_RESTART_DELAY * 2 ** (backoff - 1), MAX_RESTART_DELAY)
            : BASE_RESTART_DELAY
        console.log('[SR:onend] sessionDur=%dms backoff=%d -> restart in %dms', Math.round(sessionDur), backoff, delay)
        restartTimer = window.setTimeout(() => {
          restartTimer = null
          if (!listening.value || !rec) return
          sessionStart = performance.now()
          try {
            rec.start()
          } catch {
            /* ignore duplicate-start exception / 忽略重复启动异常 */
          }
        }, delay)
      } else {
        listening.value = false
      }
    }

    listening.value = true
    loading.value = true
    loadStart = performance.now()
    sessionStart = performance.now()
    error.value = ''
    try {
      rec.start()
      } catch {
        /* ignore if already running / 已在运行等情况忽略 */
      }
  }

  function stop() {
    console.log('stop')
    listening.value = false
    hideLoading()
    clearRestart()
    interimText.value = ''
    incrementalAccum = ''
    currentInterim = ''
    backoff = 0
    onLiveCb = null
    if (rec) {
      try {
        rec.stop()
      } catch {
        /* ignore / 忽略 */
      }
      rec = null
    }
  }

  onUnmounted(stop)

  return { available, listening, loading, error, interimText, start, stop }
}
