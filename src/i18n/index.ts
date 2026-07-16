import { reactive } from 'vue'
import zhCN from './zh-CN.json'
import zhTW from './zh-TW.json'
import en from './en.json'

export type Locale = 'zh-CN' | 'zh-TW' | 'en'

export interface LocaleMeta {
  code: Locale
  label: string
}

// 语言选择器里显示的语言名，按惯例用其原生写法（不随界面语言翻译）
export const locales: LocaleMeta[] = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
]

type Dict = Record<string, string>

const tables: Record<Locale, Dict> = {
  'zh-CN': zhCN as Dict,
  'zh-TW': zhTW as Dict,
  en: en as Dict,
}

const STORAGE_KEY = 'web-teleprompter-locale'

function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'zh-CN' || saved === 'zh-TW' || saved === 'en') return saved
  } catch {
    /* 忽略读取失败 */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en'
  const l = nav.toLowerCase()
  if (l.startsWith('zh')) {
    return l.includes('tw') || l.includes('hk') || l.includes('mo') ? 'zh-TW' : 'zh-CN'
  }
  if (l.startsWith('en')) return 'en'
  return 'en'
}

export const i18nState = reactive({
  locale: detectLocale(),
})

function applyDoc() {
  if (typeof document === 'undefined') return
  document.title = t('app.title')
  document.documentElement.lang = i18nState.locale
}

export function setLocale(locale: Locale) {
  i18nState.locale = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* 忽略写入失败 */
  }
  applyDoc()
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const table = tables[i18nState.locale] ?? en
  let s = table[key] ?? en[key] ?? key
  if (vars) {
    for (const k in vars) {
      s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]))
    }
  }
  return s
}

// 模块加载时同步文档标题与 <html lang>
applyDoc()
