import { reactive } from 'vue'
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

// 完整应用状态（含运行时字段，不全部参与配置持久化）
export const state = reactive({
  // 脚本文本
  script: '',

  // 滚动模式：fixed=固定速度；speech=语音跟随
  mode: 'fixed' as Mode,

  // 运行 / 暂停
  running: false,
  paused: false,

  // 固定速度（像素/秒）
  speed: 60,

  // 外观
  fontSize: 40,
  fontFamily: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif',
  color: '#ffffff',
  background: '#000000',
  lineHeight: 1.6,

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
})

/**
 * 可序列化配置：从 state 中提取需要保存/导出的用户设置字段。
 * 运行时字段（running/paused/matchedNorm/interimText）与派生字段（normInfo）不纳入。
 */
export const usable: (keyof typeof state)[] = [
  'script',
  'mode',
  'speed',
  'fontSize',
  'fontFamily',
  'color',
  'background',
  'lineHeight',
  'flipH',
  'flipV',
  'rotation',
  'win',
]

export type AppConfig = Pick<typeof state, (typeof usable)[number]>

export function defaultConfig(): AppConfig {
  const base = { ...state }
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
      } else {
        // @ts-expect-error 动态赋值
        state[k] = cfg[k]
      }
    }
  }
  rebuildNorm()
}

export function resetConfig() {
  applyConfig(defaultConfig())
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
