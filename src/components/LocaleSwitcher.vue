<script setup lang="ts">
import { i18nState, setLocale, locales, type Locale } from '../i18n'

function onChange(e: Event) {
  setLocale((e.target as HTMLSelectElement).value as Locale)
}
</script>

<template>
  <select
    class="locale-switcher"
    :value="i18nState.locale"
    :aria-label="i18nState.locale === 'zh-CN' ? '切换语言' : i18nState.locale === 'zh-TW' ? '切換語言' : 'Switch language'"
    @change="onChange"
  >
    <option v-for="l in locales" :key="l.code" :value="l.code">{{ l.label }}</option>
  </select>
</template>

<style scoped>
.locale-switcher {
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid var(--border-soft);
  background: var(--bg-card);
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
}
</style>
