import { recLangFamilyOf, type ScriptFamily } from './recLangs'

// 检测“一段文稿”主要由哪类文字构成，以及是否出现大段的语言混合。
// 设计目标：
//  - 允许个别外来词（如中文文稿里夹几个英文单词）不被误判为“混合语言”；
//  - 但大段不一致的语言（如中文段落里掺一大段英文）应被判定为混合。
// 所有阈值集中在此文件，便于后期按真实语料调参维护。

// 构成“一段该语言”所需的最少字符数（绝对量），低于此视为个别字词而非一段。
const MIN_CHARS = 8
// 占全部有效字符的最小比例，避免短文稿里少量字符被放大成“一段”。
const MIX_RATIO = 0.18
// 判定为日语所需的最少假名数（平/片假名只在日语中出现，是强信号）。
const MIN_KANA = 3

const FAMILIES: Exclude<ScriptFamily, 'unknown'>[] = ['han', 'japanese', 'korean', 'cyrillic', 'latin']

// 检测优先级：当日语/韩语/俄语等独有文字出现时，优先于中文/拉丁，避免误归并。
const PRIORITY: Exclude<ScriptFamily, 'unknown'>[] = ['japanese', 'korean', 'cyrillic', 'han', 'latin']

function isLatin(cp: number): boolean {
  return (
    (cp >= 0x0041 && cp <= 0x005a) || // A-Z
    (cp >= 0x0061 && cp <= 0x007a) || // a-z
    (cp >= 0x00c0 && cp <= 0x024f) || // Latin-1 Supplement + Latin Extended-A/B
    (cp >= 0x1e00 && cp <= 0x1eff) // Latin Extended Additional
  )
}

// 返回单个字符所属的原始文字家族；标点/数字/空白/符号等返回 null。
function rawFamily(cp: number): Exclude<ScriptFamily, 'unknown'> | null {
  if (cp >= 0x3040 && cp <= 0x309f) return 'japanese' // 平假名
  if (cp >= 0x30a0 && cp <= 0x30ff) return 'japanese' // 片假名
  if (cp >= 0xac00 && cp <= 0xd7a3) return 'korean' // 谚文音节
  if (cp >= 0x1100 && cp <= 0x11ff) return 'korean' // 谚文兼容字母
  if (cp >= 0x0400 && cp <= 0x04ff) return 'cyrillic' // 西里尔字母
  if (cp >= 0x0500 && cp <= 0x052f) return 'cyrillic' // 西里尔补充
  if (cp >= 0x4e00 && cp <= 0x9fff) return 'han' // CJK 统一表意文字
  if (cp >= 0x3400 && cp <= 0x4dbf) return 'han' // CJK 扩展 A
  if (isLatin(cp)) return 'latin'
  return null
}

export interface ScriptAnalysis {
  counts: Record<Exclude<ScriptFamily, 'unknown'>, number>
  total: number
  detected: ScriptFamily
  mixed: boolean
  mixedFamilies: ScriptFamily[]
}

export function analyzeScript(text: string): ScriptAnalysis {
  const counts: Record<Exclude<ScriptFamily, 'unknown'>, number> = {
    han: 0,
    japanese: 0,
    korean: 0,
    cyrillic: 0,
    latin: 0,
  }
  let kana = 0
  let total = 0

  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    const f = rawFamily(cp)
    if (!f) continue
    total++
    if (f === 'japanese') {
      kana++
      counts.japanese++
    } else {
      counts[f]++
    }
  }

  // 日语：假名只要达到一定数量即判定为日语，并将其汉字并入日语家族，
  // 避免“日语（汉字+假名）”被误判为“中文+日语混合”。
  const isJapanese = kana >= MIN_KANA
  if (isJapanese) {
    counts.japanese += counts.han
    counts.han = 0
  }

  const substantial = (f: Exclude<ScriptFamily, 'unknown'>): boolean => {
    if (total === 0) return false
    const c = counts[f]
    if (f === 'japanese') return c >= MIN_KANA
    return c >= MIN_CHARS && c / total >= MIX_RATIO
  }

  const mixedFamilies = FAMILIES.filter((f) => substantial(f))
  const detected: ScriptFamily =
    PRIORITY.find((f) => substantial(f)) ?? 'unknown'

  return {
    counts,
    total,
    detected,
    mixed: mixedFamilies.length >= 2,
    mixedFamilies,
  }
}

// 单个语言在文稿中所占比例（percent 为 0-100 的整数）
export interface LangPercent {
  family: ScriptFamily
  percent: number
}

export type SpeechLangCheck =
  | { type: 'ok' }
  | { type: 'mixed'; families: ScriptFamily[]; breakdown: LangPercent[] }
  | { type: 'mismatch'; detected: ScriptFamily; selected: ScriptFamily }

// 依据字符统计计算各文字家族占比（仅统计有效字符：字母/汉字/假名等，忽略标点数字空白）。
// 传入 only 时仅返回该集合内的家族，否则返回所有出现过的家族；结果按占比降序。
export function computeLangPercents(
  a: ScriptAnalysis,
  only?: ScriptFamily[],
): LangPercent[] {
  if (a.total === 0) return []
  const list: LangPercent[] = FAMILIES.filter((f) => (only ? only.includes(f) : counts0(a, f) > 0))
    .map((f) => ({ family: f as ScriptFamily, percent: Math.round((a.counts[f] / a.total) * 100) }))
    .sort((x, y) => y.percent - x.percent)
  return list
}

function counts0(a: ScriptAnalysis, f: Exclude<ScriptFamily, 'unknown'>): number {
  return a.counts[f]
}

// 在“语音跟随”开始前检查文稿语言是否合理：
//  - 大段混合语言 -> 'mixed'
//  - 文稿主语言与所选识别语言不一致 -> 'mismatch'
//  - 其余 -> 'ok'（无需弹窗提醒）
export function checkSpeechLanguage(text: string, recLang: string): SpeechLangCheck {
  const a = analyzeScript(text)
  if (a.mixed) {
    return { type: 'mixed', families: a.mixedFamilies, breakdown: computeLangPercents(a, a.mixedFamilies) }
  }
  if (a.detected === 'unknown') return { type: 'ok' }
  const selected = recLangFamilyOf(recLang)
  if (selected !== 'unknown' && a.detected !== selected) {
    return { type: 'mismatch', detected: a.detected, selected }
  }
  return { type: 'ok' }
}
