import { ref, onUnmounted } from 'vue'
import { t } from '../i18n'

// Web Speech API 最小类型声明（标准 lib 未包含）
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

  let rec: SpeechRecognitionLike | null = null
  let onTextCb: ((text: string) => void) | null = null
  let onLiveCb: ((text: string) => void) | null = null
  let restartTimer: number | null = null
  let loadStart = 0 // 开始加载的时间戳（用于保证最短展示时长）
  let minLoadTimer: number | null = null // 保证最短展示时长的定时器
  let incrementalAccum = '' // 跨会话累积的「新增 final」文本，作为增量回调给对齐逻辑（避免每次回传整段）
  let currentInterim = '' // 当前 interim 文本（仅用于显示，不参与对齐）

  function clearRestart() {
    if (restartTimer !== null) {
      window.clearTimeout(restartTimer)
      restartTimer = null
    }
  }

  // 真正关闭加载态，并清理相关定时器
  function hideLoading() {
    loading.value = false
    if (minLoadTimer !== null) {
      window.clearTimeout(minLoadTimer)
      minLoadTimer = null
    }
  }

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
    rec.continuous = true
    rec.interimResults = true
    rec.lang = lang || 'zh-CN'

    rec.onstart = () => {
      console.log('[SR:onstart] 识别会话已启动（每次重启都会触发）')
      // 识别引擎真正就绪，结束加载态
      endLoading()
    }

    rec.onresult = (e: SpeechRecognitionEventLike) => {
      console.log('[SR:onresult] resultIndex=%d results.length=%d', e.resultIndex, e.results.length)
      // 增量处理：只把「本次事件新增的 final」追加到跨会话缓冲，回传给对齐逻辑。
      // 浏览器会在静音/气口后结束会话并重启，重启后 results 从 0 重新计数，
      // 因此每次 onresult 都拿到“到目前为止的完整文本”——若回传整段，
      // 单会话内说话越久文本越长，App 端每次都要对整段做 O(M^2) 对齐，成本随时间膨胀。
      // 这里改为：仅 resultIndex 起（含）的 final 才是新内容（之前已处理过的不再重复追加），
      // 跨会话累积到 incrementalAccum，回传增量；interim 不稳定，仅用于显示、不参与对齐。
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
        console.log('[SR:onresult] -> 增量 final（跨会话累积）len=%d "%s"', incrementalAccum.length, incrementalAccum)
        onTextCb?.(incrementalAccum)
        incrementalAccum = ''
      }
      if (interim !== currentInterim) {
        currentInterim = interim
        interimText.value = interim
        // 实时预览：把尚未确认的 interim 文本也交给对齐逻辑，
        // 让光标在说话过程中就跟着走，而不是等一句话 final 才跟上。
        if (onLiveCb && interim) onLiveCb(interim)
      }
    }

    rec.onerror = (e: { error?: string }) => {
      console.log('[SR:onerror] error=%s', e.error)
      error.value = e.error || 'speech-error'
      hideLoading()
    }

    rec.onend = () => {
      console.log('[SR:onend] listening=%s（若为 true 将延迟重启会话）', listening.value)
      // 仍在口播中：浏览器在静音/气口后会结束识别，需要重新启动才能继续跟随。
      // 关键：在 onend 内【同步】调用 start 在 Chrome 中会抛 InvalidStateError，
      // 被 catch 吞掉后识别会彻底终止、之后不再跟随。故延迟到下一轮事件循环再启动。
      if (listening.value && rec) {
        restartTimer = window.setTimeout(() => {
          restartTimer = null
          if (!listening.value || !rec) return
          try {
            rec.start()
          } catch {
            /* 忽略重复启动异常 */
          }
        }, 80)
      } else {
        listening.value = false
      }
    }

    listening.value = true
    loading.value = true
    loadStart = performance.now()
    error.value = ''
    try {
      rec.start()
      } catch {
        /* 已在运行等情况忽略 */
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
    onLiveCb = null
    if (rec) {
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
      rec = null
    }
  }

  onUnmounted(stop)

  return { available, listening, loading, error, interimText, start, stop }
}
