import { ref, onUnmounted } from 'vue'

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
  const error = ref('')
  const interimText = ref('')
  const available = ref(supported)

  let rec: SpeechRecognitionLike | null = null
  let onFinalCb: ((text: string) => void) | null = null
  let restartTimer: number | null = null

  function clearRestart() {
    if (restartTimer !== null) {
      window.clearTimeout(restartTimer)
      restartTimer = null
    }
  }

  function start(cb: (text: string) => void) {
    if (!supported) {
      error.value = '当前浏览器不支持语音识别（建议使用 Chrome / Edge）'
      return
    }
    onFinalCb = cb
    clearRestart()
    const Ctor = (window.SpeechRecognition || window.webkitSpeechRecognition)!
    rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'zh-CN'

    rec.onresult = (e: SpeechRecognitionEventLike) => {
      let finalChunk = ''
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!
        const txt = res[0]!.transcript
        if (res.isFinal) finalChunk += txt
        else interim += txt
      }
      interimText.value = interim
      if (finalChunk) onFinalCb?.(finalChunk)
    }

    rec.onerror = (e: { error?: string }) => {
      error.value = e.error || 'speech-error'
    }

    rec.onend = () => {
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
    error.value = ''
    try {
      rec.start()
    } catch {
      /* 已在运行等情况忽略 */
    }
  }

  function stop() {
    listening.value = false
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

  return { available, listening, error, interimText, start, stop }
}
