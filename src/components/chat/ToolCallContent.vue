<template>
  <div class="tool-content">
    <div class="code-block">
      <div class="code-bar">
        <span class="code-lang">python</span>
        <button class="copy-btn" @click.stop="handleCopy(code, 'code')">
          <i :class="copied === 'code' ? 'pi pi-check' : 'pi pi-copy'"></i>
        </button>
      </div>
      <pre class="code-body"><code v-html="highlightCode(code)"></code></pre>
    </div>
    <div v-if="result" class="result-block">
      <div class="result-bar">
        <span>Output</span>
        <button class="copy-btn" @click.stop="handleCopy(result, 'result')">
          <i :class="copied === 'result' ? 'pi pi-check' : 'pi pi-copy'"></i>
        </button>
      </div>
      <pre class="result-body">{{ result }}</pre>
    </div>
    <div v-if="error" class="error-block">
      <div class="result-bar error-bar"><span>Error</span></div>
      <pre class="error-body">{{ error }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { highlightCode } from '@/composables/useMarkdown'

defineProps<{
  code?: string | null
  result?: string | null
  error?: string | null
}>()

const copied = ref<string | null>(null)
let timeout: ReturnType<typeof setTimeout> | null = null

function handleCopy(text: string | null | undefined, key: string) {
  if (!text) return
  navigator.clipboard.writeText(text).catch(() => {})
  copied.value = key
  if (timeout) clearTimeout(timeout)
  timeout = setTimeout(() => { copied.value = null }, 2000)
}
</script>

<style scoped>
.tool-content {
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

/* Code header bar */
.code-bar, .result-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.45rem 0.85rem;
  font-size: 0.8rem;
  color: var(--text-muted);
}
.code-bar { background: #252535; }
.result-bar { background: #1c1c28; border-top: 1px solid rgba(255, 255, 255, 0.05); }
.error-bar { background: rgba(180, 40, 40, 0.15); }

.code-lang {
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.78rem;
  cursor: pointer;
  padding: 0.15rem 0.35rem;
  border-radius: var(--radius-sm);
  transition: color 0.15s;
}
.copy-btn:hover { color: var(--text-secondary); }
.copy-btn .pi-check { color: #5cb85c; }

/* Code body */
.code-body {
  background: #1a1a2e;
  padding: 0.9rem 1rem;
  margin: 0;
  overflow: auto;
  max-height: 420px;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.88rem;
  line-height: 1.55;
  tab-size: 4;
  -webkit-font-smoothing: antialiased;
  color: #abb2bf;
}
.code-body code {
  font-family: inherit;
  background: transparent;
  padding: 0;
}

/* Syntax highlighting (atom-one-dark inspired, inline) */
.code-body :deep(.hljs-keyword),
.code-body :deep(.hljs-selector-tag) { color: #c678dd; }
.code-body :deep(.hljs-string),
.code-body :deep(.hljs-addition) { color: #98c379; }
.code-body :deep(.hljs-number),
.code-body :deep(.hljs-literal) { color: #d19a66; }
.code-body :deep(.hljs-built_in),
.code-body :deep(.hljs-title.function_) { color: #61afef; }
.code-body :deep(.hljs-title.class_) { color: #e5c07b; }
.code-body :deep(.hljs-comment),
.code-body :deep(.hljs-quote) { color: #5c6370; font-style: italic; }
.code-body :deep(.hljs-variable),
.code-body :deep(.hljs-template-variable) { color: #e06c75; }
.code-body :deep(.hljs-attr) { color: #d19a66; }
.code-body :deep(.hljs-params) { color: #abb2bf; }
.code-body :deep(.hljs-punctuation) { color: #abb2bf; }
.code-body :deep(.hljs-operator) { color: #56b6c2; }
.code-body :deep(.hljs-meta) { color: #61afef; }

/* Result body */
.result-body {
  background: #141420;
  padding: 0.85rem 1rem;
  margin: 0;
  max-height: 350px;
  overflow: auto;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.85rem;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.45;
}

/* Error body */
.error-body {
  background: rgba(120, 20, 20, 0.15);
  padding: 0.85rem 1rem;
  margin: 0;
  max-height: 250px;
  overflow: auto;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.85rem;
  color: var(--error-text);
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.45;
}

/* Scrollbar for code/result */
.code-body::-webkit-scrollbar,
.result-body::-webkit-scrollbar,
.error-body::-webkit-scrollbar { width: 6px; height: 6px; }
.code-body::-webkit-scrollbar-track,
.result-body::-webkit-scrollbar-track,
.error-body::-webkit-scrollbar-track { background: transparent; }
.code-body::-webkit-scrollbar-thumb,
.result-body::-webkit-scrollbar-thumb,
.error-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
.code-body::-webkit-scrollbar-thumb:hover,
.result-body::-webkit-scrollbar-thumb:hover,
.error-body::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
</style>
