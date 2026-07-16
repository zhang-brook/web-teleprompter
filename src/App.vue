<script setup lang="ts">
import { ref, watch } from 'vue'
import ControlPanel from './components/ControlPanel.vue'
import PrompterWindow from './components/PrompterWindow.vue'
import { state, initPersist, initTheme, rebuildNorm } from './store'
import { useSpeechRecognition } from './composables/useSpeechRecognition'
import { normalizeText, alignForward } from './utils/match'

const speech = useSpeechRecognition()
const showPanel = ref(typeof window !== 'undefined' ? window.innerWidth >= 768 : true)
// 记录开始前的面板展示状态，停止后据此决定是否还原
let panelShownBeforeStart = true
const toast = ref('')

initPersist()
initTheme()

watch(speech.interimText, (v) => {
  state.interimText = v
})
watch(speech.error, (v) => {
  if (v) {
    toast.value = '语音识别：' + v
    setTimeout(() => (toast.value = ''), 4000)
  }
})

// 已用于对齐的识别文本累计量，保证只对新内容做增量对齐
let recNormAcc = ''

function handleFinal(text: string) {
  const recNorm = normalizeText(text)
  if (recNorm.length > recNormAcc.length && recNorm.startsWith(recNormAcc)) {
    // 仅对齐新增部分（识别引擎返回增量文本时）
    const delta = recNorm.slice(recNormAcc.length)
    state.matchedNorm = alignForward(state.normInfo.norm, state.matchedNorm, delta)
  } else {
    // 无法增量（识别引擎重置/回传累计文本）时，从当前位置稍前处整体重对齐
    state.matchedNorm = alignForward(state.normInfo.norm, Math.max(0, state.matchedNorm - 24), recNorm)
  }
  recNormAcc = recNorm
}

function start() {
  if (!state.script.trim()) {
    toast.value = '请先在设置中输入文稿'
    setTimeout(() => (toast.value = ''), 3000)
    return
  }
  if (state.mode === 'speech' && !speech.available.value) {
    toast.value = '当前浏览器不支持语音识别，请使用 Chrome / Edge 访问'
    setTimeout(() => (toast.value = ''), 4000)
    return
  }
  state.matchedNorm = 0
  state.interimText = ''
  recNormAcc = ''
  panelShownBeforeStart = showPanel.value
  state.running = true
  state.paused = false
  showPanel.value = false // 开始后自动隐藏设置面板，进入纯净口播视图
  if (state.mode === 'speech') speech.start(handleFinal)
}

function stop() {
  state.running = false
  state.paused = false
  speech.stop()
  recNormAcc = ''
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
    toast.value = '仅支持导入 .txt 文本文档'
    setTimeout(() => (toast.value = ''), 3000)
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    state.script = String(reader.result ?? '')
    rebuildNorm()
    toast.value = '已从 ' + file.name + ' 导入文稿'
    setTimeout(() => (toast.value = ''), 3000)
  }
  reader.onerror = () => {
    toast.value = '导入失败：无法读取文件'
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
        <span>网页提词器</span>
      </div>
      <div class="actions">
        <button class="primary" @click="start" :disabled="state.running">开始</button>
        <button @click="stop" :disabled="!state.running">停止</button>
        <button class="ghost" @click="showPanel = !showPanel">
          {{ showPanel ? '隐藏设置' : '设置' }}
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

    <div v-if="isDragging" class="drop-overlay">
      <div class="drop-hint">拖入 .txt 文档以导入文稿</div>
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
