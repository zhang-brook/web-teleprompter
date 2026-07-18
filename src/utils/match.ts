// Text normalization and "smart alignment" utilities.
// 文本归一化与“机灵匹配”工具
// Used for speech-following: align the recognized text with the script character by character,
// 用于语音识别跟随：把识别到的文本与脚本逐字（逐字符）对齐，
// tolerating pauses (silence) and rephrasings (different wording).
// 处理气口（静音）与换种表述（措辞不同）的情况

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
 * Normalize text by stripping whitespace and punctuation (for cross-wording matching) and lowercasing Latin letters.
 * 归一化文本：去掉空白与标点（便于跨表述匹配），英文转小写
 * Also build the bidirectional mapping between normalized indices and original indices.
 * 同时建立 归一化下标 <-> 原始下标 的双向映射
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

/** Return only the normalized string (used for recognized text). */
/** 仅返回归一化字符串（用于识别文本）。 */
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
 * Fault-tolerant alignment (edit distance): align the recognized text r (the whole utterance) into the script, allowing its "head" to start at the script's beginning,
 * 容错对齐（编辑距离）：把识别文本 r（整段 utterance）对齐进脚本，允许其“头部”落在脚本开头，
 * and constraining only its "end position" to fall within the window [fromNorm-back, fromNorm+forward].
 * 只约束其“结束位置”落在 [fromNorm-back, fromNorm+forward] 窗口内
 *
 * Key point: each onresult delivers the full utterance "so far", whose head corresponds to the script's beginning,
 * 关键点：onresult 每次拿到的是“到目前为止的完整 utterance”，其头部对应脚本开头，
 * while the user's current mouth position is near fromNorm. So the head must match freely from script 0,
 * 而用户当前嘴部位置在 fromNorm 附近。因此头部必须从脚本 0 开始自由匹配，
 * and only the "end" is limited to a local window, otherwise the whole utterance fails to align once its head falls outside the window (and stalls after a few dozen characters).
 * 只限制“结束位”在本地窗口，避免整段 utterance 因头部落在窗口外而无法对齐（否则读几十字就卡死）。
 *
 * Three low-cost operations are allowed, tolerating at once:
 * 允许三类低代价操作，从而同时容忍：
 *   - substitution: mis-recognized characters (e.g. "页"↔"业", minor English word differences) — corresponds to "tolerate mis-recognized characters".
 *   - 替换(substitution)：识别错字（如“页”↔“业”、英文整词微差）—— 对应“要兼容错字”。
 *   - deletion: the user skipped a few characters, or the recognizer dropped some — corresponds to "skip a few characters and still match".
 *   - 删除(deletion)：用户漏读 / 跳过了几个字、或识别漏字 —— 对应“跳过几个字也能识别”。
 *   - insertion: the recognizer added filler words etc., which we skip.
 *   - 插入(insertion)：识别多读了语气词等填充内容，跳过这些识别字
 *
 * Match cost: hit = 0; the other three operations each cost 1. The whole alignment must cost <= maxCost to be considered "matched".
 * 匹配代价：命中=0，其余三类操作各=1。要求整段对齐代价 <= maxCost 才算“对得上”。
 * Returns the aligned end index within the window (i.e. the latest read position); returns -1 if it cannot align within budget.
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
  // Row range: the end position must lie within [lo, hi]; to hold the whole r (M columns), the start row may reach as early as 0.
  // 行范围：结束位置必须在 [lo, hi]；为容纳整段 r（M 列），起始行可早至 0。
  const rowEnd = Math.min(N, hi + M)
  const INF = 1e9
  let prev = new Array(M + 1).fill(INF)
  prev[0] = 0
  let bestCost = INF
  let bestEnd = -1
  for (let p = 1; p <= rowEnd; p++) {
    const cur = new Array(M + 1).fill(INF)
    // The head may be cheaply anchored at the [script start (0)] or the [current read position (fromNorm)]:
    // 头部可低价锚定在【脚本开头(0)】或【当前朗读位置(fromNorm)】：
    //  - Normal single session: the recognized text is the full text accumulated from the session start, head at 0, cost 0;
    //  - 正常单次会话：识别文本是从会话开头累计的完整文本，头部在 0，代价 0；
    //  - After a session restarts due to network error/silence, results re-accumulate from 0 and the new text only contains what was said after restart,
    //  - 会话因网络错误/静音重启后 results 重新累计，新文本只含重启后说的话，
    //    so its head corresponds to fromNorm; without relaxing the cost, p≈fromNorm would far exceed maxCost and never match (cursor stalls).
    //    头部对应 fromNorm，若不放宽代价则 p≈fromNorm 远超 maxCost 而永远对不上（光标卡死）。
    cur[0] = Math.min(p, Math.abs(p - fromNorm))
    const sc = script[p - 1]!
    for (let j = 1; j <= M; j++) {
      const cost = sc === r[j - 1]! ? 0 : 1
      let v = prev[j - 1]! + cost // hit / substitution / 命中 / 替换
      if (prev[j]! + 1 < v) v = prev[j]! + 1 // delete a script char (skipped) / 删除 script 字符（漏读/跳过）
      if (cur[j - 1]! + 1 < v) v = cur[j - 1]! + 1 // insert (skip extra recognized char) / 插入（跳过识别多读的字）
      cur[j] = v
    }
    // r is fully consumed and the end falls inside the local window: record the best end position.
    // r 已被完整消费且结束位落在本地窗口内：记录最佳结束位置
    if (p >= lo && p <= hi && cur[M]! <= maxCost) {
      const c = cur[M]!
      // Prefer the smallest cost; ties go to the end nearest fromNorm (avoid needless forward jumps); further ties take the smaller end (conservative).
      // 代价最小者优先；平局取距 fromNorm 更近者（避免无谓前跳）；再平局取更小结束位（保守）。
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
 * Fault-tolerantly align the recognized text recognizedNorm (the whole utterance) into the script,
 * 把识别文本 recognizedNorm（整段 utterance）容错对齐进脚本，
 * and return the normalized index at the aligned end (i.e. the latest read position); if it cannot match, stay put.
 * 返回对齐结束处的归一化下标（即最新朗读到的位置）；对不上则原地不动
 *
 * - back: how many characters backward the alignment may step (to fix a missed match at an earlier pause/breather).
 * - back：允许向前回退的字符数（修正前面漏匹配的气口 / 停顿）。
 * - forward: how many characters forward (the user's live position) to search; the window is strictly limited to avoid random long jumps.
 * - forward：允许向前（用户正在朗读的位置）搜索的字符数；窗口严格限制，避免随机跳远
 * - maxCostRatio: the tolerance budget as a ratio of the recognized length (substitution/deletion/insertion all count); larger tolerates more mis-recognized chars and skips.
 * - maxCostRatio：容错预算占识别长度的比例（替换/删除/插入均计入），越大越能容忍错字与跳读
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
    console.log('[MATCH:alignForward] -> RETURN stayed=%d (budget exceeded, stay put)', fromNorm)
    // Could not align within budget, stay at the original position.
    // 预算内对不上，原地不动
    return fromNorm
  }
  const r = Math.min(normScript.length, end)
  console.log('[MATCH:alignForward] -> RETURN advanced=%d (advanced, within cost)', r)
  // Advanced, within the allowed cost.
  // 推进, cost内
  return r
}
