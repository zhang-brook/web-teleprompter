<script setup lang="ts">
import { ref, computed } from 'vue'
import { state, rebuildNorm, exportConfig, importConfig, resetConfig } from '../store'

const fonts = [
  { label: '系统默认', value: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif' },
  { label: '黑体 / 无衬线', value: '"Microsoft YaHei", "PingFang SC", sans-serif' },
  { label: '宋体 / 衬线', value: 'SimSun, "Songti SC", serif' },
  { label: '楷体', value: 'KaiTi, "Kaiti SC", serif' },
  { label: '等宽', value: '"Cascadia Code", Consolas, monospace' },
]

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
  msg.value = '配置已导出'
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
    msg.value = ok ? '配置已导入' : '导入失败：文件格式不正确'
    setTimeout(() => (msg.value = ''), 3000)
  }
  reader.readAsText(file)
  input.value = ''
}
</script>

<template>
  <div class="panel">
    <section class="sec">
      <h3>文稿</h3>
      <textarea
        class="script"
        :value="state.script"
        @input="onScriptInput"
        placeholder="在此输入口播文稿……"
      ></textarea>
      <p class="hint">
        也可以直接把本地 .txt 文档拖拽到页面任意位置，自动导入为文稿。
      </p>
    </section>

    <section class="sec">
      <h3>主题</h3>
      <div class="seg">
        <button :class="{ active: state.theme === 'dark' }" @click="state.theme = 'dark'">深色</button>
        <button :class="{ active: state.theme === 'light' }" @click="state.theme = 'light'">浅色</button>
        <button :class="{ active: state.theme === 'system' }" @click="state.theme = 'system'">跟随系统</button>
      </div>
    </section>

    <section class="sec">
      <h3>滚动模式</h3>
      <div class="seg">
        <button :class="{ active: state.mode === 'fixed' }" @click="state.mode = 'fixed'">
          固定速度
        </button>
        <button :class="{ active: state.mode === 'speech' }" @click="state.mode = 'speech'">
          语音跟随
        </button>
      </div>

      <div v-if="state.mode === 'fixed'" class="field">
        <label>速度（像素/秒）：{{ state.speed }}</label>
        <input type="range" min="10" max="400" step="5" v-model.number="state.speed" />
      </div>

      <p v-else class="hint">
        语音跟随：说出文稿内容，文字会自动滚到当前读到/说到的位置并居中。<br />
        已自动处理停顿气口与换种表述；可用鼠标滚轮在滚动时上下微调（偏移保持）。
      </p>
    </section>

    <section class="sec">
      <h3>外观</h3>
      <div class="field">
        <label>字体</label>
        <select v-model="state.fontFamily">
          <option v-for="f in fonts" :key="f.value" :value="f.value">{{ f.label }}</option>
        </select>
      </div>
      <div class="field">
        <label>字号：{{ state.fontSize }}px</label>
        <input type="range" min="16" max="120" step="1" v-model.number="state.fontSize" />
      </div>
      <div class="field row">
        <label>文字颜色</label>
        <input type="color" v-model="state.color" />
        <label>背景</label>
        <input type="color" v-model="state.background" />
      </div>
      <label class="check">
        <input type="checkbox" v-model="state.breakWords" />
        英文单词可在行尾断开（拆开放两行）
      </label>
    </section>

    <section class="sec">
      <h3>朗读线</h3>
      <div class="field">
        <label>位置（距顶部）：{{ readLinePct }}%</label>
        <input type="range" min="5" max="95" step="1" v-model.number="readLinePct" />
      </div>
      <p class="hint">当前阅读位置会对齐到该线；口播时也可直接拖动悬浮窗中的朗读线上下调整。</p>
    </section>

    <section class="sec">
      <h3>翻转 / 旋转</h3>
      <div class="flips">
        <button :class="{ active: state.flipH }" @click="state.flipH = !state.flipH">水平翻转</button>
        <button :class="{ active: state.flipV }" @click="state.flipV = !state.flipV">垂直翻转</button>
      </div>
      <div class="angles">
        <button :class="{ active: state.rotation === 0 }" @click="state.rotation = 0">0°</button>
        <button :class="{ active: state.rotation === 90 }" @click="state.rotation = 90">90°</button>
        <button :class="{ active: state.rotation === 180 }" @click="state.rotation = 180">180°</button>
        <button :class="{ active: state.rotation === 270 }" @click="state.rotation = 270">270°</button>
      </div>
      <div class="field">
        <label>任意角度：{{ state.rotation }}°</label>
        <input type="range" min="0" max="359" step="1" v-model.number="state.rotation" />
      </div>
    </section>

    <section class="sec">
      <h3>漂浮窗</h3>
      <div class="seg">
        <button :class="{ active: state.windowMode === 'float' }" @click="state.windowMode = 'float'">浮窗</button>
        <button :class="{ active: state.windowMode === 'window' }" @click="state.windowMode = 'window'">窗口全屏</button>
        <button :class="{ active: state.windowMode === 'screen' }" @click="state.windowMode = 'screen'">屏幕全屏</button>
      </div>
      <button class="wide" style="margin-top: 8px" @click="resetWin">重置窗口位置/大小</button>
      <p class="hint">浮窗模式可拖拽标题栏移动、拖右下角缩放；窗口全屏填满主区域；屏幕全屏进入浏览器全屏。</p>
    </section>

    <section class="sec">
      <h3>配置</h3>
      <div class="row2">
        <button class="wide" @click="doExport">导出配置</button>
        <button class="wide" @click="triggerImport">导入配置</button>
      </div>
      <button class="wide" style="margin-top: 8px" @click="resetConfig">恢复默认设置</button>
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
</style>
