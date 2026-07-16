// 语音识别可选语言（BCP-47 标签，原生写法不随界面语言翻译）
export interface RecLang {
  value: string
  label: string
}

export const recLangs: RecLang[] = [
  { value: 'zh-CN', label: '简体中文（普通话）' },
  { value: 'zh-TW', label: '繁體中文（國語）' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'es-ES', label: 'Español' },
  { value: 'ru-RU', label: 'Русский' },
]

// 每种识别语言对应的“文字家族”（用于与文稿实际语言做粗粒度比对）。
// 同一文字家族内的语言（如 en-US/en-GB、fr/de/es 同属拉丁字母）无法靠脚本区分，
// 故视为同一家族；中文（含简/繁）、日语、韩语、俄语各自独立。
export type ScriptFamily = 'han' | 'japanese' | 'korean' | 'cyrillic' | 'latin' | 'unknown'

export const recLangFamily: Record<string, ScriptFamily> = {
  'zh-CN': 'han',
  'zh-TW': 'han',
  'en-US': 'latin',
  'en-GB': 'latin',
  'ja-JP': 'japanese',
  'ko-KR': 'korean',
  'fr-FR': 'latin',
  'de-DE': 'latin',
  'es-ES': 'latin',
  'ru-RU': 'cyrillic',
}

export function recLangLabel(value: string): string {
  return recLangs.find((l) => l.value === value)?.label ?? value
}

export function recLangFamilyOf(value: string): ScriptFamily {
  return recLangFamily[value] ?? 'unknown'
}

export function isKnownRecLang(value: string): boolean {
  return recLangs.some((l) => l.value === value)
}
