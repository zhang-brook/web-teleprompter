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
 * 容错对齐（编辑距离）：把识别文本 r（整段 utterance）对齐进脚本，允许其“头部”落在脚本开头，
 * 只约束其“结束位置”落在 [fromNorm-back, fromNorm+forward] 窗口内。
 *
 * 关键点：onresult 每次拿到的是“到目前为止的完整 utterance”，其头部对应脚本开头，
 * 而用户当前嘴部位置在 fromNorm 附近。因此头部必须从脚本 0 开始自由匹配，
 * 只限制“结束位”在本地窗口，避免整段 utterance 因头部落在窗口外而无法对齐（否则读几十字就卡死）。
 *
 * 允许三类低代价操作，从而同时容忍：
 *   - 替换(substitution)：识别错字（如“页”↔“业”、英文整词微差）—— 对应“要兼容错字”。
 *   - 删除(deletion)：用户漏读 / 跳过了几个字、或识别漏字 —— 对应“跳过几个字也能识别”。
 *   - 插入(insertion)：识别多读了语气词等填充内容，跳过这些识别字。
 *
 * 匹配代价：命中=0，其余三类操作各=1。要求整段对齐代价 <= maxCost 才算“对得上”。
 * 返回落在窗口内的对齐结束下标（即最新朗读到的位置）；无法在预算内对齐则返回 -1。
 */
function tolerantAlign(
  script: string,
  fromNorm: number,
  r: string,
  back: number,
  forward: number,
  maxCost: number,
): number {
  const N = script.length
  const M = r.length
  if (M === 0) return fromNorm
  const lo = Math.max(0, fromNorm - back)
  const hi = Math.min(N, fromNorm + forward)
  if (lo > hi) return -1
  // 行范围：结束位置必须在 [lo, hi]；为容纳整段 r（M 列），起始行可早至 0。
  const rowEnd = Math.min(N, hi + M)
  const INF = 1e9
  let prev = new Array(M + 1).fill(INF)
  prev[0] = 0
  let bestCost = INF
  let bestEnd = -1
  for (let p = 1; p <= rowEnd; p++) {
    const cur = new Array(M + 1).fill(INF)
    // 头部可低价锚定在【脚本开头(0)】或【当前朗读位置(fromNorm)】：
    //  - 正常单次会话：识别文本是从会话开头累计的完整文本，头部在 0，代价 0；
    //  - 会话因网络错误/静音重启后 results 重新累计，新文本只含重启后说的话，
    //    头部对应 fromNorm，若不放宽代价则 p≈fromNorm 远超 maxCost 而永远对不上（光标卡死）。
    cur[0] = Math.min(p, Math.abs(p - fromNorm))
    const sc = script[p - 1]!
    for (let j = 1; j <= M; j++) {
      const cost = sc === r[j - 1]! ? 0 : 1
      let v = prev[j - 1]! + cost // 命中 / 替换
      if (prev[j]! + 1 < v) v = prev[j]! + 1 // 删除 script 字符（漏读/跳过）
      if (cur[j - 1]! + 1 < v) v = cur[j - 1]! + 1 // 插入（跳过识别多读的字）
      cur[j] = v
    }
    // r 已被完整消费且结束位落在本地窗口内：记录最佳结束位置
    if (p >= lo && p <= hi && cur[M]! <= maxCost) {
      const c = cur[M]!
      // 代价最小者优先；平局取距 fromNorm 更近者（避免无谓前跳）；再平局取更小结束位（保守）
      const d = Math.abs(p - fromNorm)
      const bd = bestEnd < 0 ? Infinity : Math.abs(bestEnd - fromNorm)
      if (c < bestCost || (c === bestCost && (d < bd || (d === bd && p < bestEnd)))) {
        bestCost = c
        bestEnd = p
      }
    }
    prev = cur
  }
  return bestEnd
}

/**
 * 把识别文本 recognizedNorm（整段 utterance）容错对齐进脚本，
 * 返回对齐结束处的归一化下标（即最新朗读到的位置）；对不上则原地不动。
 *
 * - back：允许向前回退的字符数（修正前面漏匹配的气口 / 停顿）。
 * - forward：允许向前（用户正在朗读的位置）搜索的字符数；窗口严格限制，避免随机跳远。
 * - maxCostRatio：容错预算占识别长度的比例（替换/删除/插入均计入），越大越能容忍错字与跳读。
 */
export function alignForward(
  normScript: string,
  fromNorm: number,
  recognizedNorm: string,
  opts: { back?: number; forward?: number; maxCostRatio?: number } = {},
): number {
  if (!recognizedNorm) return fromNorm
  const back = opts.back ?? 40
  const forward = opts.forward ?? 300
  const maxCostRatio = opts.maxCostRatio ?? 0.35
  const maxCost = Math.max(2, Math.floor(recognizedNorm.length * maxCostRatio))
  console.log('[MATCH:alignForward] fromNorm=%d recNorm.len=%d scriptNorm.len=%d back=%d forward=%d endWindow=[%d,%d] maxCost=%d', fromNorm, recognizedNorm.length, normScript.length, back, forward, Math.max(0, fromNorm - back), Math.min(normScript.length, fromNorm + forward), maxCost)

  const end = tolerantAlign(normScript, fromNorm, recognizedNorm, back, forward, maxCost)
  if (end < 0) {
    console.log('[MATCH:alignForward] -> RETURN stayed=%d (预算内对不上，原地不动)', fromNorm)
    return fromNorm
  }
  const r = Math.min(normScript.length, end)
  console.log('[MATCH:alignForward] -> RETURN advanced=%d (推进, cost内)', r)
  return r
}
