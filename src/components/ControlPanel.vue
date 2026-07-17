<script setup lang="ts">
import { ref, computed } from 'vue'
import { state, rebuildNorm, exportConfig, importConfig, resetConfig } from '../store'
import { t } from '../i18n'
import { recLangs, isKnownRecLang } from '../utils/recLangs'

const fonts = [
  { tkey: 'font.system', value: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif' },
  { tkey: 'font.sans', value: '"Microsoft YaHei", "PingFang SC", sans-serif' },
  { tkey: 'font.serif', value: 'SimSun, "Songti SC", serif' },
  { tkey: 'font.kai', value: 'KaiTi, "Kaiti SC", serif' },
  { tkey: 'font.mono', value: '"Cascadia Code", Consolas, monospace' },
]

// 保证已选语言仍在可选列表中（兼容旧配置/导入的非法值）
function recLangValid(v: string): boolean {
  return isKnownRecLang(v)
}

function onScriptInput(e: Event) {
  state.script = (e.target as HTMLTextAreaElement).value
  rebuildNorm()
}

function resetWin() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const mobile = vw < 768
  if (mobile) {
    state.win = { x: 8, y: 70, w: vw - 16, h: vh - 150 }
  } else {
    state.win = { x: Math.round(vw / 2 - 300), y: 90, w: 600, h: Math.min(420, vh - 180) }
  }
}

// 朗读线位置以比例(0~1)存储，滑块用百分比(5~95)展示，二者互转避免显示 500%~9500%
const readLinePct = computed({
  get: () => Math.round(state.readLine * 100),
  set: (v: number) => {
    state.readLine = Math.max(0.05, Math.min(0.95, v / 100))
  },
})

const msg = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

function doExport() {
  const data = exportConfig()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'teleprompter-config.json'
  a.click()
  URL.revokeObjectURL(url)
  msg.value = t('msg.exported')
  setTimeout(() => (msg.value = ''), 2500)
}

function triggerImport() {
  fileInput.value?.click()
}

function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const ok = importConfig(String(reader.result))
    msg.value = ok ? t('msg.imported') : t('msg.importFailed')
    setTimeout(() => (msg.value = ''), 3000)
  }
  reader.readAsText(file)
  input.value = ''
}
</script>

<template>
  <div class="panel">
    <section class="sec">
      <h3>{{ t('panel.script') }}</h3>
      <textarea
        class="script"
        :value="state.script"
        @input="onScriptInput"
        :placeholder="t('panel.scriptPlaceholder')"
      ></textarea>
      <p class="hint">{{ t('panel.scriptHint') }}</p>
    </section>

    <section class="sec">
      <h3>{{ t('panel.theme') }}</h3>
      <div class="seg">
        <button :class="{ active: state.theme === 'dark' }" @click="state.theme = 'dark'">{{ t('theme.dark') }}</button>
        <button :class="{ active: state.theme === 'light' }" @click="state.theme = 'light'">{{ t('theme.light') }}</button>
        <button :class="{ active: state.theme === 'system' }" @click="state.theme = 'system'">{{ t('theme.system') }}</button>
      </div>
    </section>

    <section class="sec">
      <h3>{{ t('panel.scrollMode') }}</h3>
      <div class="seg">
        <button :class="{ active: state.mode === 'fixed' }" @click="state.mode = 'fixed'">
          {{ t('mode.fixed') }}
        </button>
        <button :class="{ active: state.mode === 'speech' }" @click="state.mode = 'speech'">
          {{ t('mode.speech') }}
        </button>
      </div>

      <div v-if="state.mode === 'fixed'" class="field">
        <label>{{ t('panel.speed', { value: state.speed }) }}</label>
        <input type="range" min="10" max="400" step="5" v-model.number="state.speed" />
      </div>

      <p v-else class="hint">{{ t('panel.speechHint') }}</p>

      <div v-if="state.mode === 'speech'" class="field">
        <label>{{ t('panel.recLang') }}</label>
        <select v-model="state.recLang">
          <option v-for="l in recLangs" :key="l.value" :value="l.value">{{ l.label }}</option>
        </select>
        <p v-if="!recLangValid(state.recLang)" class="hint">{{ t('panel.recLangInvalid') }}</p>
        <p class="hint warn">{{ t('panel.recLangMonoHint') }}</p>
      </div>

      <div class="field">
        <label>{{ t('panel.wheelStep', { value: state.wheelStep }) }}</label>
        <input type="range" min="10" max="300" step="5" v-model.number="state.wheelStep" />
      </div>
    </section>

    <section class="sec">
      <h3>{{ t('panel.appearance') }}</h3>
      <div class="field">
        <label>{{ t('panel.font') }}</label>
        <select v-model="state.fontFamily">
          <option v-for="f in fonts" :key="f.value" :value="f.value">{{ t(f.tkey) }}</option>
        </select>
      </div>
      <div class="field">
        <label>{{ t('panel.fontSize', { value: state.fontSize }) }}</label>
        <input type="range" min="16" max="120" step="1" v-model.number="state.fontSize" />
      </div>
      <div class="field">
        <label>{{ t('panel.lineHeight', { value: state.lineHeight }) }}</label>
        <input type="range" min="1" max="3" step="0.1" v-model.number="state.lineHeight" />
      </div>
      <div class="field">
        <label>{{ t('panel.letterSpacing', { value: state.letterSpacing }) }}</label>
        <input type="range" min="0" max="20" step="0.5" v-model.number="state.letterSpacing" />
      </div>
      <div class="field row">
        <label>{{ t('panel.textColor') }}</label>
        <input type="color" v-model="state.color" />
        <label>{{ t('panel.background') }}</label>
        <input type="color" v-model="state.background" />
      </div>
      <label class="check">
        <input type="checkbox" v-model="state.breakWords" />
        {{ t('panel.breakWords') }}
      </label>
    </section>

    <section class="sec">
      <h3>{{ t('panel.readLine') }}</h3>
      <div class="field">
        <label>{{ t('panel.readLinePos', { value: readLinePct }) }}</label>
        <input type="range" min="5" max="95" step="1" v-model.number="readLinePct" />
      </div>
      <p class="hint">{{ t('panel.readLineHint') }}</p>
    </section>

    <section class="sec">
      <h3>{{ t('panel.flipRotate') }}</h3>
      <div class="flips">
        <button :class="{ active: state.flipH }" @click="state.flipH = !state.flipH">{{ t('flip.h') }}</button>
        <button :class="{ active: state.flipV }" @click="state.flipV = !state.flipV">{{ t('flip.v') }}</button>
      </div>
      <div class="angles">
        <button :class="{ active: state.rotation === 0 }" @click="state.rotation = 0">0°</button>
        <button :class="{ active: state.rotation === 90 }" @click="state.rotation = 90">90°</button>
        <button :class="{ active: state.rotation === 180 }" @click="state.rotation = 180">180°</button>
        <button :class="{ active: state.rotation === 270 }" @click="state.rotation = 270">270°</button>
      </div>
      <div class="field">
        <label>{{ t('panel.angle', { value: state.rotation }) }}</label>
        <input type="range" min="0" max="359" step="1" v-model.number="state.rotation" />
      </div>
    </section>

    <section class="sec">
      <h3>{{ t('panel.floatWindow') }}</h3>
      <div class="seg">
        <button :class="{ active: state.windowMode === 'float' }" @click="state.windowMode = 'float'">{{ t('windowMode.float') }}</button>
        <button :class="{ active: state.windowMode === 'window' }" @click="state.windowMode = 'window'">{{ t('windowMode.window') }}</button>
        <button :class="{ active: state.windowMode === 'screen' }" @click="state.windowMode = 'screen'">{{ t('windowMode.screen') }}</button>
      </div>
      <button class="wide" style="margin-top: 8px" @click="resetWin">{{ t('panel.resetWin') }}</button>
      <p class="hint">{{ t('panel.floatHint') }}</p>
    </section>

    <section class="sec">
      <h3>{{ t('panel.config') }}</h3>
      <div class="row2">
        <button class="wide" @click="doExport">{{ t('config.export') }}</button>
        <button class="wide" @click="triggerImport">{{ t('config.import') }}</button>
      </div>
      <button class="wide" style="margin-top: 8px" @click="resetConfig">{{ t('config.reset') }}</button>
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        style="display: none"
        @change="onImportFile"
      />
      <p v-if="msg" class="hint">{{ msg }}</p>
    </section>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  overflow-y: auto;
  height: 100%;
  box-sizing: border-box;
}
.sec {
  background: var(--bg-card);
  border: 1px solid var(--border-soft);
  border-radius: 10px;
  padding: 12px;
}
.sec h3 {
  margin: 0 0 10px;
  font-size: 14px;
  color: var(--text-dim);
  font-weight: 600;
}
.script {
  width: 100%;
  height: 160px;
  resize: vertical;
  background: var(--bg-input);
  color: var(--text);
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
  line-height: 1.5;
  box-sizing: border-box;
}
.field {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field.row {
  flex-direction: row;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
}
.check input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}
.field label {
  font-size: 13px;
  color: var(--text);
}
input[type='range'] {
  width: 100%;
}
select,
input[type='color'] {
  background: var(--bg-input);
  color: var(--text);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  padding: 4px;
}
.seg,
.flips,
.angles {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.seg button,
.flips button,
.angles button {
  flex: 1;
  min-width: 60px;
  padding: 8px 6px;
  background: var(--bg-input);
  color: var(--text);
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}
button.active {
  background: var(--accent);
  color: var(--accent-text);
  border-color: var(--accent);
}
.wide {
  width: 100%;
  padding: 8px;
  background: var(--bg-input);
  color: var(--text);
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  cursor: pointer;
}
.row2 {
  display: flex;
  gap: 8px;
}
.row2 .wide {
  flex: 1;
}
.hint {
  font-size: 12px;
  color: var(--text-mute);
  line-height: 1.5;
  margin: 8px 0 0;
}
.hint.warn {
  color: #e8a33d;
}
</style>