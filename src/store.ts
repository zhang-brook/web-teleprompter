import { reactive, watch } from 'vue'
import { buildNorm } from './utils/match'

export type Mode = 'fixed' | 'speech'

export interface WinGeom {
  x: number
  y: number
  w: number
  h: number
}

export interface NormInfo {
  norm: string
  normToOrig: number[]
  origToNorm: number[]
}

function defaultWin(): WinGeom {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const mobile = vw < 768
  if (mobile) {
    return { x: 8, y: 70, w: vw - 16, h: vh - 150 }
  }
  return { x: Math.round(vw / 2 - 300), y: 90, w: 600, h: Math.min(420, vh - 180) }
}

// 真正的默认值工厂：每次调用返回一份全新的默认状态。
// 注意：必须从这份常量取默认值，绝不能从当前 state 读取，否则“恢复默认设置”会失效。
function makeDefaults() {
  return {
    // 脚本文本
    script: '',

    // 滚动模式：fixed=固定速度；speech=语音跟随
    mode: 'fixed' as Mode,

    // 语音识别语言（BCP-47，如 zh-CN / en-US）
    recLang: 'zh-CN',

    // 运行 / 暂停
    running: false,
    paused: false,

    // 固定速度（像素/秒）
    speed: 60,

    // 鼠标滚轮每格文字上/下移动的距离（像素），避免一滚就飞很远找不到位置
    wheelStep: 80,

    // 外观
    fontSize: 40,
    fontFamily: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif',
    color: '#ffffff',
    background: '#000000',
    lineHeight: 1.6,

    // 英文单词是否允许在行尾断开（true=可拆开放两行；false=整词换行）
    breakWords: false,

    // 朗读线位置（视口高度的比例，0~1）
    readLine: 0.4,

    // 主题：dark / light / system
    theme: 'system' as 'dark' | 'light' | 'system',

    // 窗口模式：float=浮窗，window=窗口全屏（填满主区域），screen=屏幕全屏
    windowMode: 'float' as 'float' | 'window' | 'screen',

    // 变换：水平翻转、垂直翻转、任意角度旋转
    flipH: false,
    flipV: false,
    rotation: 0,

    // 漂浮窗几何
    win: defaultWin(),

    // 归一化脚本（用于语音匹配）
    normInfo: { norm: '', normToOrig: [], origToNorm: [] } as NormInfo,

    // 语音已匹配到的归一化位置
    matchedNorm: 0,

    // 语音识别临时文本（用于界面展示）
    interimText: '',
  }
}

// 完整应用状态（含运行时字段，不全部参与配置持久化）
export const state = reactive(makeDefaults())

/**
 * 可序列化配置：从 state 中提取需要保存/导出的用户设置字段。
 * 运行时字段（running/paused/matchedNorm/interimText）与派生字段（normInfo）不纳入。
 */
export const usable: (keyof typeof state)[] = [
  'script',
  'mode',
  'recLang',
  'speed',
  'wheelStep',
  'fontSize',
  'fontFamily',
  'color',
  'background',
  'lineHeight',
  'breakWords',
  'readLine',
  'theme',
  'flipH',
  'flipV',
  'rotation',
  'win',
]

export type AppConfig = Pick<typeof state, (typeof usable)[number]>

export function defaultConfig(): AppConfig {
  const base = makeDefaults()
  const cfg = {} as AppConfig
  for (const k of usable) {
    // 深拷贝窗口几何，避免引用同一对象
    if (k === 'win') {
      cfg.win = { ...(base.win as WinGeom) }
    } else {
      // @ts-expect-error 动态赋值
      cfg[k] = base[k]
    }
  }
  return cfg
}

export function toConfig(): AppConfig {
  const cfg = {} as AppConfig
  for (const k of usable) {
    if (k === 'win') {
      cfg.win = { ...(state.win as WinGeom) }
    } else {
      // @ts-expect-error 动态赋值
      cfg[k] = state[k]
    }
  }
  return cfg
}

export function applyConfig(cfg: Partial<AppConfig>) {
  for (const k of usable) {
    if (k in cfg && cfg[k] !== undefined) {
      if (k === 'win') {
        state.win = { ...(cfg.win as WinGeom) }
      } else if (k === 'readLine') {
        // 朗读线位置以比例(0~1)存储，兼容旧配置中误存的百分比数值
        const r = cfg[k] as unknown as number
        state.readLine = Math.max(0.05, Math.min(0.95, r > 1 ? r / 100 : r))
      } else if (k === 'recLang') {
        // 语音识别语言：仅接受已知的 BCP-47 标签，非法值回退到默认 zh-CN
        const v = cfg[k] as unknown as string
        const KNOWN = ['zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE', 'es-ES', 'ru-RU']
        state.recLang = KNOWN.includes(v) ? v : 'zh-CN'
      } else {
        // @ts-expect-error 动态赋值
        state[k] = cfg[k]
      }
    }
  }
  rebuildNorm()
}

export function resetConfig() {
  // 把整个状态重置为真正的默认值，确保包括 windowMode、运行/暂停等所有字段都被还原。
  Object.assign(state, makeDefaults())
  rebuildNorm()
}

// 导出当前配置为 JSON 字符串
export function exportConfig(): string {
  return JSON.stringify(toConfig(), null, 2)
}

// 从 JSON 字符串导入配置；解析失败返回 false
export function importConfig(json: string): boolean {
  try {
    const cfg = JSON.parse(json) as Partial<AppConfig>
    if (typeof cfg !== 'object' || cfg === null) return false
    applyConfig(cfg)
    return true
  } catch {
    return false
  }
}

// ===== 本地持久化 =====
const STORAGE_KEY = 'web-teleprompter-config'

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, exportConfig())
  } catch {
    /* 忽略写入失败（如隐私模式） */
  }
}

export function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) importConfig(raw)
  } catch {
    /* 忽略读取失败 */
  }
}

export function initPersist() {
  loadPersisted()
  // 配置变化时自动写入本地，刷新不丢失
  watch(() => exportConfig(), persist)
}

// 脚本变化时重建归一化信息并重置匹配进度
export function rebuildNorm() {
  state.normInfo = buildNorm(state.script)
  state.matchedNorm = 0
}

// 计算变换样式
export function transformStyle(): string {
  const parts: string[] = []
  if (state.flipH) parts.push('scaleX(-1)')
  if (state.flipV) parts.push('scaleY(-1)')
  parts.push(`rotate(${state.rotation}deg)`)
  return parts.join(' ')
}

// ===== 主题 =====
function applyTheme() {
  if (typeof document === 'undefined') return
  const t = state.theme
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
  const effective = t === 'system' ? (prefersLight ? 'light' : 'dark') : t
  document.documentElement.dataset.theme = effective
}

export function initTheme() {
  applyTheme()
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme)
  }
  watch(() => state.theme, applyTheme)
}
