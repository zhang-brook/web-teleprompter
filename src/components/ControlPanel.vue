<script setup lang="ts">
import { state, rebuildNorm } from '../store'

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
    </section>

    <section class="sec">
      <h3>朗读线</h3>
      <div class="field">
        <label>位置（距顶部）：{{ Math.round(state.readLine * 100) }}%</label>
        <input type="range" min="5" max="95" step="1" v-model.number="state.readLine" />
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
      <button class="wide" @click="resetWin">重置窗口位置/大小</button>
      <p class="hint">口播时可直接拖拽标题栏移动，拖右下角缩放。</p>
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
  background: #1b1f27;
  border: 1px solid #2a2f3a;
  border-radius: 10px;
  padding: 12px;
}
.sec h3 {
  margin: 0 0 10px;
  font-size: 14px;
  color: #9aa4b2;
  font-weight: 600;
}
.script {
  width: 100%;
  height: 160px;
  resize: vertical;
  background: #0f1218;
  color: #e6e9ef;
  border: 1px solid #2a2f3a;
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
.field label {
  font-size: 13px;
  color: #c2c9d6;
}
input[type='range'] {
  width: 100%;
}
select,
input[type='color'] {
  background: #0f1218;
  color: #e6e9ef;
  border: 1px solid #2a2f3a;
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
  background: #0f1218;
  color: #c2c9d6;
  border: 1px solid #2a2f3a;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
}
button.active {
  background: #2f6df6;
  color: #fff;
  border-color: #2f6df6;
}
.wide {
  width: 100%;
  padding: 8px;
  background: #0f1218;
  color: #c2c9d6;
  border: 1px solid #2a2f3a;
  border-radius: 8px;
  cursor: pointer;
}
.hint {
  font-size: 12px;
  color: #8a93a3;
  line-height: 1.5;
  margin: 8px 0 0;
}
</style>
