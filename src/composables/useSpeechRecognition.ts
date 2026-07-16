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
  let restartTimer: number | null = null
  let loadStart = 0 // 开始加载的时间戳（用于保证最短展示时长）
  let minLoadTimer: number | null = null // 保证最短展示时长的定时器

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

  function start(cb: (text: string) => void, lang?: string) {
    if (!supported) {
      error.value = t('speech.unsupported')
      return
    }
    onTextCb = cb
    clearRestart()
    const Ctor = (window.SpeechRecognition || window.webkitSpeechRecognition)!
    rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = lang || 'zh-CN'

    rec.onstart = () => {
      console.log('onstart')
      // 识别引擎真正就绪，结束加载态
      endLoading()
    }

    rec.onresult = (e: SpeechRecognitionEventLike) => {
      console.log('onresult', e)
      // 每次事件都拿到本次识别会话“到目前为止”的完整文本（所有结果，final + interim 按序拼接）。
      // 浏览器在静音/气口后会结束会话并重启，此时 results 自动从头开始，
      // 因此这里无需手动维护累计文本——从 results 重新拼接即可得到当前会话的完整内容，
      // 重启后会自动以新会话内容继续在脚本当前位置之后对齐。
      let text = ''
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i]!
        const txt = res[0]!.transcript
        text += txt
        if (!res.isFinal) interim += txt
      }
      interimText.value = interim
      if (text) onTextCb?.(text)
    }

    rec.onerror = (e: { error?: string }) => {
      console.log('onerror', e)
      error.value = e.error || 'speech-error'
      hideLoading()
    }

    rec.onend = () => {
      console.log('onend')
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
