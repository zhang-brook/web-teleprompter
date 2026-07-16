// 文本归一化与“机灵匹配”工具
// 用于语音识别跟随：把识别到的文本与脚本逐字（逐字符）对齐，
// 处理气口（静音）与换种表述（措辞不同）的情况。

const PUNCT_RE = /[\s\p{P}\p{S}]/u

function isSkippable(ch: string): boolean {
  return PUNCT_RE.test(ch)
}

export interface NormInfo {
  norm: string
  normToOrig: number[]
  origToNorm: number[]
}

/**
 * 归一化文本：去掉空白与标点（便于跨表述匹配），英文转小写。
 * 同时建立 归一化下标 <-> 原始下标 的双向映射。
 */
export function buildNorm(text: string): NormInfo {
  const normToOrig: number[] = []
  const origToNorm: number[] = new Array(text.length).fill(-1)
  let norm = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (isSkippable(ch)) continue
    origToNorm[i] = norm.length
    normToOrig.push(i)
    norm += ch.toLowerCase()
  }
  return { norm, normToOrig, origToNorm }
}

/** 仅返回归一化字符串（用于识别文本） */
export function normalizeText(text: string): string {
  let norm = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (isSkippable(ch)) continue
    norm += ch.toLowerCase()
  }
  return norm
}

/**
 * 模糊匹配长度：从 script[s] 起，与 r 进行贪心对齐，
 * 允许跳过最多 maxSkip 个 script 字符（应对漏读/换表述）。
 * 返回成功匹配的长度。
 */
function fuzzyLen(script: string, s: number, r: string, maxSkip: number): number {
  let i = s
  let j = 0
  let matched = 0
  let skip = 0
  while (i < script.length && j < r.length) {
    if (script[i] === r[j]) {
      i++
      j++
      matched++
    } else {
      // 跳过脚本里的一个字符（说话人换种表述 / 跳过了原词）
      skip++
      if (skip > maxSkip) break
      i++
    }
  }
  return matched
}

/**
 * 从当前已匹配位置 fromNorm 开始，在前向窗口内寻找识别文本 r 的最佳对齐点。
 * - 允许少量回退（fromNorm-8）以修正前面漏匹配的气口/停顿。
 * - 在多个候选中选取匹配最长者，平局取起点更靠前的（避免无谓前跳）。
 * 返回新的“已匹配归一化下标”（不含匹配区间末端之后的位置）。
 */
export function alignForward(
  normScript: string,
  fromNorm: number,
  recognizedNorm: string,
  opts: { window?: number; maxSkip?: number } = {},
): number {
  if (!recognizedNorm) return fromNorm
  const window = opts.window ?? recognizedNorm.length * 6 + 80
  const maxSkip = opts.maxSkip ?? 10
  const startMin = Math.max(0, fromNorm - 8)
  const startMax = Math.min(normScript.length, fromNorm + window)

  let bestStart = fromNorm
  let bestLen = 0
  for (let s = startMin; s <= startMax; s++) {
    const len = fuzzyLen(normScript, s, recognizedNorm, maxSkip)
    if (len > bestLen) {
      bestLen = len
      bestStart = s
    }
  }

  // 至少匹配到一定长度才推进，过滤识别噪声
  const minLen = Math.min(2, recognizedNorm.length)
  if (bestLen >= minLen) {
    return Math.min(normScript.length, bestStart + bestLen)
  }
  return fromNorm
}
