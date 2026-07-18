import { reactive, watch, computed } from 'vue'
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

// The real default-value factory: each call returns a brand-new default state.
// 真正的默认值工厂：每次调用返回一份全新的默认状态
// Note: defaults must come from this constant, never read from the current state, otherwise "restore defaults" would break.
// 注意：必须从这份常量取默认值，绝不能从当前 state 读取，否则“恢复默认设置”会失效
function makeDefaults() {
  return {
    // Script text.
    // 脚本文本
    script: '',

    // Scroll mode: fixed = constant speed; speech = speech-following.
    // 滚动模式：fixed=固定速度；speech=语音跟随
    mode: 'fixed' as Mode,

    // Speech recognition language (BCP-47, e.g. zh-CN / en-US).
    // 语音识别语言（BCP-47，如 zh-CN / en-US）
    recLang: 'zh-CN',

    // Running / paused.
    // 运行 / 暂停
    running: false,
    paused: false,

    // Fixed speed (pixels per second).
    // 固定速度（像素/秒）
    speed: 60,

    // Pixels the text moves per mouse-wheel notch, so one notch does not fly far away and lose the position.
    // 鼠标滚轮每格文字上/下移动的距离（像素），避免一滚就飞很远找不到位置
    wheelStep: 80,

    // Appearance.
    // 外观
    fontSize: 40,
    fontFamily: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif',
    color: '#ffffff',
    background: '#000000',
    lineHeight: 1.6,
    letterSpacing: 0,

    // Whether an English word may break at the line end (true = split across two lines; false = whole-word wrap).
    // 英文单词是否允许在行尾断开（true=可拆开放两行；false=整词换行）
    breakWords: false,

    // Whether to remove consecutive blank lines (true = keep at most one blank line between paragraphs).
    // 是否移除连续空白行（true=每段之间最多保留一个空白行）
    removeBlankLines: true,

    // Read-line position (ratio of viewport height, 0~1).
    // 朗读线位置（视口高度的比例，0~1）
    readLine: 0.4,

    // Theme: dark / light / system.
    // 主题：dark / light / system
    theme: 'system' as 'dark' | 'light' | 'system',

    // Window mode: float = floating window; window = full main area; screen = browser fullscreen; screen-float = fullscreen floating (browser fullscreen but shown internally as a float).
    // 窗口模式：float=浮窗，window=窗口全屏（填满主区域），screen=屏幕全屏，screen-float=全屏浮窗（浏览器全屏但内部以浮窗展示）
    windowMode: 'float' as 'float' | 'window' | 'screen' | 'screen-float',

    // Transform: horizontal flip, vertical flip, arbitrary rotation.
    // 变换：水平翻转、垂直翻转、任意角度旋转
    flipH: false,
    flipV: false,
    rotation: 0,

    // Floating window geometry.
    // 漂浮窗几何
    win: defaultWin(),

    // Normalized script (used for speech matching).
    // 归一化脚本（用于语音匹配）
    normInfo: { norm: '', normToOrig: [], origToNorm: [] } as NormInfo,

    // Speech-matched normalized position (the final-confirmed anchor).
    // 语音已匹配到的归一化位置（final 确认的锚点）
    matchedNorm: 0,

    // Speech live-preview position (advanced in real time by interim, >= matchedNorm).
    // 语音实时预览位置（由 interim 实时推进，>= matchedNorm）
    // Used for scroll/highlight following, so the cursor moves while speaking instead of waiting for a sentence's final.
    // 用于滚动/高亮跟随，使光标在读的过程中就跟着走，而非等一句话 final 才跟上
    liveNorm: 0,

    // Speech recognition interim text (for display only).
    // 语音识别临时文本（用于界面展示）
    interimText: '',
  }
}

// Full application state (includes runtime fields; not all of it is persisted as config).
// 完整应用状态（含运行时字段，不全部参与配置持久化）。
export const state = reactive(makeDefaults())

/**
 * Serializable config: extract the user-setting fields from state that should be saved/exported.
 * 可序列化配置：从 state 中提取需要保存/导出的用户设置字段
 * Runtime fields (running/paused/matchedNorm/liveNorm/interimText) and derived fields (normInfo) are excluded.
 * 运行时字段（running/paused/matchedNorm/liveNorm/interimText）与派生字段（normInfo）不纳入
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
  'letterSpacing',
  'breakWords',
  'removeBlankLines',
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
    // Deep-copy the window geometry so we don't share the same object reference.
    // 深拷贝窗口几何，避免引用同一对象
    if (k === 'win') {
      cfg.win = { ...(base.win as WinGeom) }
    } else {
      // @ts-expect-error dynamic assignment / 动态赋值
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
      // @ts-expect-error dynamic assignment / 动态赋值
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
        // The read-line position is stored as a ratio (0~1) for backward compatibility with legacy configs that mistakenly stored a percentage.
        // 朗读线位置以比例(0~1)存储，兼容旧配置中误存的百分比数值
        const r = cfg[k] as unknown as number
        state.readLine = Math.max(0.05, Math.min(0.95, r > 1 ? r / 100 : r))
      } else if (k === 'recLang') {
        // Speech recognition language: only accept known BCP-47 tags; fall back to default zh-CN for illegal values.
        // 语音识别语言：仅接受已知的 BCP-47 标签，非法值回退到默认 zh-CN
        const v = cfg[k] as unknown as string
        const KNOWN = ['zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE', 'es-ES', 'ru-RU']
        state.recLang = KNOWN.includes(v) ? v : 'zh-CN'
      } else {
        // @ts-expect-error dynamic assignment / 动态赋值
        state[k] = cfg[k]
      }
    }
  }
  rebuildNorm()
}

export function resetConfig() {
  // Reset the whole state to the real defaults, ensuring every field including windowMode/running/paused is restored.
  // 把整个状态重置为真正的默认值，确保包括 windowMode、运行/暂停等所有字段都被还原
  Object.assign(state, makeDefaults())
  rebuildNorm()
}

// Export the current config as a JSON string.
// 导出当前配置为 JSON 字符串
export function exportConfig(): string {
  return JSON.stringify(toConfig(), null, 2)
}

// Import config from a JSON string; return false on parse failure.
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

// ===== Local persistence =====
// ===== 本地持久化 =====
const STORAGE_KEY = 'web-teleprompter-config'

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, exportConfig())
  } catch {
    /* ignore write failure (e.g. private mode) / 忽略写入失败（如隐私模式） */
  }
}

export function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) importConfig(raw)
  } catch {
    /* ignore read failure / 忽略读取失败 */
  }
}

export function initPersist() {
  loadPersisted()
  // Auto-write to local storage on config change, so a refresh does not lose data.
  // 配置变化时自动写入本地，刷新不丢失
  watch(() => exportConfig(), persist)
}

// Merge consecutive blank lines: compress multiple blank lines (lines with only whitespace) into at most one,
// 合并连续空白行：把连续多个空白行（仅含空白字符的行）压缩为最多一个空白行，
// used for both display and speech normalization so "what you see" matches "what is matched".
// 既用于显示也用于语音归一化，保证“看到的内容”与“匹配的内容”一致
export function collapseBlankLines(text: string): string {
  const lines = text.split(/\r\n|\r|\n/)
  const out: string[] = []
  let inBlank = false
  for (const line of lines) {
    const blank = line.trim() === ''
    if (blank) {
      if (!inBlank) {
        out.push('')
        inBlank = true
      }
      // Consecutive blank lines: skip, keep only one.
      // 连续空白行：跳过，只保留一个
    } else {
      out.push(line)
      inBlank = false
    }
  }
  return out.join('\n')
}

// The script actually used for display/matching: collapse consecutive blank lines depending on the setting.
// 实际用于显示/匹配的文稿：按配置决定是否合并连续空白行
export const displayScript = computed(() =>
  state.removeBlankLines ? collapseBlankLines(state.script) : state.script,
)

// Rebuild the normalized info and reset the match progress when the script changes.
// 脚本变化时重建归一化信息并重置匹配进度
export function rebuildNorm() {
  state.normInfo = buildNorm(displayScript.value)
  state.matchedNorm = 0
}

// The "remove blank lines" toggle also needs to rebuild the normalized info to stay consistent with the displayed content.
// “移除连续空白行”开关变化时需要同步重建归一化信息（与显示内容保持一致）
watch(
  () => displayScript.value,
  () => rebuildNorm(),
)

// Compute the transform style.
// 计算变换样式
export function transformStyle(): string {
  const parts: string[] = []
  if (state.flipH) parts.push('scaleX(-1)')
  if (state.flipV) parts.push('scaleY(-1)')
  parts.push(`rotate(${state.rotation}deg)`)
  return parts.join(' ')
}

// ===== Theme =====
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
