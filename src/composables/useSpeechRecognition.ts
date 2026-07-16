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
  const available = ref(supported)

  let rec: SpeechRecognitionLike | null = null
  let onFinalCb: ((text: string) => void) | null = null

  function start(cb: (text: string) => void) {
    if (!supported) {
      error.value = '当前浏览器不支持语音识别（建议使用 Chrome / Edge）'
      return
    }
    onFinalCb = cb
    const Ctor = (window.SpeechRecognition || window.webkitSpeechRecognition)!
    rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'zh-CN'

    rec.onresult = (e: SpeechRecognitionEventLike) => {
      let finalChunk = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalChunk += res[0].transcript
      }
      if (finalChunk) onFinalCb?.(finalChunk)
    }

    rec.onerror = (e: { error?: string }) => {
      error.value = e.error || 'speech-error'
    }

    rec.onend = () => {
      // 气口/静音导致识别结束时，若仍在口播中则自动重启，保持匹配位置不丢失
      if (listening.value && rec) {
        try {
          rec.start()
        } catch {
          /* 忽略重复 start 异常 */
        }
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

  return { available, listening, error, start, stop }
}
