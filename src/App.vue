<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import PrompterWindow from './components/PrompterWindow.vue'
import { state, initPersist, initTheme, rebuildNorm } from './store'
import { useSpeechRecognition } from './composables/useSpeechRecognition'
import { normalizeText, alignForward } from './utils/match'
import { checkSpeechLanguage, type SpeechLangCheck } from './utils/langDetect'
import { recLangLabel } from './utils/recLangs'
import { t } from './i18n'
import LocaleSwitcher from './components/LocaleSwitcher.vue'

const speech = useSpeechRecognition()
const showPanel = ref(typeof window !== 'undefined' ? window.innerWidth >= 768 : true)
// 记录开始前的面板展示状态，停止后据此决定是否还原
let panelShownBeforeStart = true
const toast = ref('')
// 语音开始前语言检查结果：非 null 时弹出确认/提醒对话框，尚未真正开始
const langCheck = ref<SpeechLangCheck | null>(null)

// 将检查结果整理为模板可直接使用的展示数据（含已翻译的标签），避免模板内类型收窄问题
const langCheckInfo = computed(() => {
  const c = langCheck.value
  if (!c || c.type === 'ok') return null
  if (c.type === 'mixed') return { kind: 'mixed' as const }
  return {
    kind: 'mismatch' as const,
    detected: t('speech.family.' + c.detected),
    selected: recLangLabel(state.recLang),
  }
})

initPersist()
initTheme()

watch(speech.interimText, (v) => {
  state.interimText = v
})
watch(speech.error, (v) => {
  if (v) {
    toast.value = t('speech.errorPrefix') + v
    setTimeout(() => (toast.value = ''), 4000)
  }
})

// 语音识别回调：收到“当前会话完整文本（final+interim）”，
// 在脚本当前位置附近的受限窗口内对齐，推进最新朗读到的位置。
function handleText(text: string) {
  const recNorm = normalizeText(text)
  console.log('[APP:handleText] raw.len=%d recNorm.len=%d recNorm="%s" scriptNorm.len=%d', text.length, recNorm.length, recNorm, state.normInfo.norm.length)
  if (!recNorm) return
  const before = state.matchedNorm
  const after = alignForward(state.normInfo.norm, before, recNorm, {
    back: 40,
    forward: 300,
  })
  console.log('[APP:handleText] matchedNorm %d -> %d (%s)', before, after, after > before ? 'ADVANCED' : 'STAYED')
  state.matchedNorm = after
}

function start() {
  if (!state.script.trim()) {
    toast.value = t('toast.enterScriptFirst')
    setTimeout(() => (toast.value = ''), 3000)
    return
  }
  if (state.mode === 'speech' && !speech.available.value) {
    toast.value = t('toast.speechUnsupported')
    setTimeout(() => (toast.value = ''), 4000)
    return
  }
  // 语音跟随：开始前先校验文稿语言，避免用户用错语言或混语言口播
  if (state.mode === 'speech') {
    const res = checkSpeechLanguage(state.script, state.recLang)
    if (res.type !== 'ok') {
      langCheck.value = res
      return
    }
  }
  doStart()
}

function doStart() {
  state.matchedNorm = 0
  state.interimText = ''
  panelShownBeforeStart = showPanel.value
  state.running = true
  state.paused = false
  showPanel.value = false // 开始后自动隐藏设置面板，进入纯净口播视图
  if (state.mode === 'speech') speech.start(handleText, state.recLang)
}

// 弹窗“返回选择”：关闭对话框并展开设置面板，方便用户改语言
function backToSelect() {
  langCheck.value = null
  showPanel.value = true
}

// 弹窗“继续开始”：用户已知晓风险仍要开始
function continueStart() {
  langCheck.value = null
  doStart()
}

function stop() {
  state.running = false
  state.paused = false
  speech.stop()
  state.matchedNorm = 0
  state.interimText = ''
  // 停止前若面板处于隐藏状态（通常由开始自动隐藏所致），则还原到开始前的展示状态；
  // 若停止前面板已展开（用户运行中手动展开过），则保持展开，不恢复。
  if (!showPanel.value) {
    showPanel.value = panelShownBeforeStart
  }
}

// ===== 拖入 txt 文档导入文稿 =====
const isDragging = ref(false)

function isTextFile(f: File): boolean {
  return f.type.startsWith('text/') || /\.txt$/i.test(f.name)
}

function onDragOver(e: DragEvent) {
  const dt = e.dataTransfer
  if (dt && Array.from(dt.items).some((it) => it.kind === 'file')) {
    e.preventDefault()
    isDragging.value = true
  }
}

function onDragLeave(e: DragEvent) {
  if (e.relatedTarget === null) isDragging.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  if (!isTextFile(file)) {
    toast.value = t('toast.onlyTxt')
    setTimeout(() => (toast.value = ''), 3000)
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    state.script = String(reader.result ?? '')
    rebuildNorm()
    toast.value = t('toast.importedFrom', { name: file.name })
    setTimeout(() => (toast.value = ''), 3000)
  }
  reader.onerror = () => {
    toast.value = t('toast.readFailed')
    setTimeout(() => (toast.value = ''), 3000)
  }
  reader.readAsText(file)
}
</script>

<template>
  <div class="app" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
    <header class="topbar">
      <div class="brand">
        <img class="brand-logo" src="/logo.svg" alt="Logo" />
        <span>{{ t('app.name') }}</span>
      </div>
      <div class="actions">
        <button class="primary" @click="start" :disabled="state.running">{{ t('action.start') }}</button>
        <button @click="stop" :disabled="!state.running">{{ t('action.stop') }}</button>
        <LocaleSwitcher />
        <button class="ghost" @click="showPanel = !showPanel">
          {{ showPanel ? t('action.hideSettings') : t('action.settings') }}
        </button>
      </div>
    </header>

    <div class="body">
      <aside class="sidebar" :class="{ open: showPanel }">
        <ControlPanel />
      </aside>
      <main class="stage">
        <PrompterWindow @stop="stop" />
        <div v-if="toast" class="toast">{{ toast }}</div>
      </main>
    </div>

    <div v-if="speech.loading.value" class="speech-loading">
      <div class="spinner"></div>
      <span class="speech-loading-text">{{ t('speech.loading') }}</span>
    </div>

    <div v-if="langCheckInfo" class="lang-check">
      <div class="lang-check-card">
        <h3 v-if="langCheckInfo.kind === 'mixed'">{{ t('speech.langCheckMixedTitle') }}</h3>
        <h3 v-else>{{ t('speech.langCheckMismatchTitle') }}</h3>
        <p v-if="langCheckInfo.kind === 'mixed'">{{ t('speech.langCheckMixed') }}</p>
        <p v-else>
          {{ t('speech.langCheckMismatch', { detected: langCheckInfo.detected, selected: langCheckInfo.selected }) }}
        </p>
        <div class="lang-check-actions">
          <button class="primary" @click="backToSelect">{{ t('action.backToSelect') }}</button>
          <button class="weak" @click="continueStart">{{ t('action.continueStart') }}</button>
        </div>
      </div>
    </div>

    <div v-if="isDragging" class="drop-overlay">
      <div class="drop-hint">{{ t('drop.hint') }}</div>
    </div>
  </div>
</template>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-app);
  color: var(--text);
  overflow: hidden;
}
.topbar {
  height: 52px;
  flex: 0 0 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  background: var(--bg-topbar);
  border-bottom: 1px solid var(--border);
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 15px;
}
.brand-logo {
  width: 24px;
  height: 24px;
  display: block;
}
.actions {
  display: flex;
  gap: 8px;
}
.actions button {
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid var(--border-soft);
  background: var(--bg-card);
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
}
.actions button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-text);
}
.actions button.ghost {
  background: transparent;
}
.actions button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.body {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  min-height: 0;
}
.sidebar {
  width: 340px;
  flex: 0 0 340px;
  border-right: 1px solid var(--border);
  background: var(--bg-panel);
  min-height: 0;
}
@media (min-width: 768px) {
  .sidebar {
    transition: flex-basis 0.2s ease, width 0.2s ease, padding 0.2s ease;
  }
  .sidebar:not(.open) {
    flex-basis: 0;
    width: 0;
    padding: 0;
    border-right: none;
    overflow: hidden;
  }
}
.stage {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
.toast {
  position: absolute;
  left: 50%;
  bottom: 20px;
  transform: translateX(-50%);
  background: var(--toast-bg);
  border: 1px solid var(--toast-border);
  color: var(--toast-text);
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  z-index: 50;
  max-width: 90%;
}
.drop-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  pointer-events: none;
}
.drop-hint {
  padding: 18px 26px;
  border: 2px dashed var(--accent);
  border-radius: 12px;
  color: var(--text);
  background: var(--bg-card);
  font-size: 15px;
}
.speech-loading {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
}
.spinner {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: 4px solid rgba(255, 255, 255, 0.25);
  border-top-color: var(--accent);
  animation: speech-spin 0.8s linear infinite;
}
.speech-loading-text {
  font-size: 14px;
  color: var(--text);
}
@keyframes speech-spin {
  to {
    transform: rotate(360deg);
  }
}
.lang-check {
  position: fixed;
  inset: 0;
  z-index: 110;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  padding: 16px;
  box-sizing: border-box;
}
.lang-check-card {
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: 12px;
  padding: 18px 20px;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
}
.lang-check-card h3 {
  margin: 0 0 10px;
  font-size: 16px;
  color: var(--text);
}
.lang-check-card p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-dim);
}
.lang-check-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 18px;
}
.lang-check-actions button {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border-soft);
  background: var(--bg-input);
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
}
.lang-check-actions button.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-text);
}
.lang-check-actions button.weak {
  opacity: 0.7;
}

@media (max-width: 767px) {
  .sidebar {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 100%;
    z-index: 40;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
    border-right: none;
  }
  .sidebar.open {
    transform: translateX(0);
  }
}
</style>
