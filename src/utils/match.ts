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
 * 模糊对齐：从 script[s] 起，与 r 进行贪心对齐。
 * 遇到不匹配时跳过 script 中的字符（容忍漏读 / 换种表述 / 气口），
 * 但跳过的累计数量不能超过 maxSkip，否则认为该起点无法对齐。
 * 返回：len = 成功匹配的 r 中字符数；end = 匹配结束时在 script 中的下标。
 */
function fuzzyAlign(
  script: string,
  s: number,
  r: string,
  maxSkip: number,
): { len: number; end: number } {
  let i = s
  let j = 0
  let skip = 0
  while (i < script.length && j < r.length) {
    if (script[i] === r[j]) {
      i++
      j++
    } else {
      // 跳过脚本里的一个字符（说话人换种表述 / 跳过了原词 / 气口）
      skip++
      if (skip > maxSkip) break
      i++
    }
  }
  return { len: j, end: i }
}

/**
 * 在 fromNorm 附近、受限的窗口内寻找识别文本 recognizedNorm 的最佳对齐点。
 *
 * - back：允许向前回退的归一化字符数（修正前面漏匹配的气口 / 停顿）。
 * - forward：允许向前（用户正在朗读的位置）搜索的归一化字符数。
 *   窗口被严格限制，避免识别到脚本后面某处重复短语时“随机跳远”。
 * - 在候选起点中选取匹配最长者（即识别文本与脚本重合最多的位置）；
 *   平局取起点更靠前者，避免无谓前跳导致画面乱跳。
 *
 * 只有匹配到足够比例（容忍少量识别噪声 / 换表述）才推进，否则原地不动，
 * 防止识别到脚本外内容时乱跳。
 * 返回匹配结束处在 script 中的归一化下标（即最新朗读到的位置）。
 */
export function alignForward(
  normScript: string,
  fromNorm: number,
  recognizedNorm: string,
  opts: { back?: number; forward?: number; maxSkip?: number } = {},
): number {
  if (!recognizedNorm) return fromNorm
  const back = opts.back ?? 40
  const forward = opts.forward ?? 300
  const maxSkip = opts.maxSkip ?? Math.max(8, Math.floor(recognizedNorm.length * 0.15))
  const startMin = Math.max(0, fromNorm - back)
  const startMax = Math.min(normScript.length, fromNorm + forward)

  let bestStart = fromNorm
  let bestLen = 0
  let bestEnd = fromNorm
  for (let s = startMin; s <= startMax; s++) {
    const { len, end } = fuzzyAlign(normScript, s, recognizedNorm, maxSkip)
    if (len > bestLen) {
      bestLen = len
      bestStart = s
      bestEnd = end
    }
  }

  // 至少匹配到一定比例才推进（短句则至少 2 个字符），过滤识别噪声与脚本外内容
  const minLen = Math.max(2, Math.floor(recognizedNorm.length * 0.6))
  if (bestLen >= minLen) {
    return Math.min(normScript.length, bestEnd)
  }
  return fromNorm
}
