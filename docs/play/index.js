import { html, reactive } from '@src/index'
import logoUrl from '../img/logo.png'
import arrowTypes from './arrow-types.d.ts?raw'
import {
  ENTRY_FILE,
  cloneExampleFiles,
  getPlaygroundExample,
} from './example-registry'
import { playgroundExampleHref, starterExampleId } from './example-meta'

const MONACO_BASE = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min'
const MONACO_URL = `${MONACO_BASE}/vs`
const DESKTOP_SPLIT_BREAKPOINT = 1080
const MIN_SPLIT_PANE = 320
const SPLITTER_SIZE = 7
const PLAYGROUND_DEFAULT_EXAMPLE = starterExampleId
const FILE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*\.(ts|css)$/

const state = reactive({
  activeFile: ENTRY_FILE,
  canResize:
    typeof window !== 'undefined'
      ? window.innerWidth > DESKTOP_SPLIT_BREAKPOINT
      : true,
  copied: false,
  editorWidth: 0,
  exampleId:
    typeof window !== 'undefined'
      ? getExampleIdFromLocation()
      : PLAYGROUND_DEFAULT_EXAMPLE,
  menuFile: '',
  menuX: 0,
  menuY: 0,
  renaming: '',
  resizing: false,
  files: cloneExampleFiles(
    getPlaygroundExample(
      typeof window !== 'undefined'
        ? getExampleIdFromLocation()
        : PLAYGROUND_DEFAULT_EXAMPLE
    ).files
  ).map(([name]) => ({
    errors: 0,
    name,
  })),
})

let monacoLoader
let monaco
let editor
let updateTimer = 0
let hashTimer = 0
let highlightTimer = 0
let previewFrame
let pendingModules = null
let applyingHash = false
let lastHash = ''
let compileId = 0
let previewReady = false
let htmlDecorations

const models = new Map()
const viewStates = new Map()

const encodeText = (text) => {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  bytes.forEach((value) => {
    binary += String.fromCharCode(value)
  })
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

const decodeText = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '==='.slice((normalized.length + 3) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function getExampleIdFromLocation() {
  const params = new URLSearchParams(window.location.search)
  const exampleId = params.get('example')

  return getPlaygroundExample(exampleId).id
}

const isSupportedFileName = (value) => FILE_NAME_PATTERN.test(value)
const isTsFileName = (value) => value.endsWith('.ts')
const isCssFileName = (value) => value.endsWith('.css')

const createSnapshot = () => ({
  active: state.activeFile,
  files: state.files.map((file) => [
    file.name,
    models.get(file.name)?.getValue() ?? '',
  ]),
})

const encodeSnapshot = () => encodeText(JSON.stringify(createSnapshot()))

const parseSnapshot = (hash) => {
  if (!hash) return null

  try {
    const parsed = JSON.parse(decodeText(hash))
    if (!parsed || !Array.isArray(parsed.files)) return null

    const files = parsed.files
      .filter(
        (entry) =>
          Array.isArray(entry) &&
          typeof entry[0] === 'string' &&
          typeof entry[1] === 'string' &&
          isSupportedFileName(entry[0])
      )
      .map(([name, code]) => [name, code])

    if (!files.length) return null
    if (!files.some(([name]) => name === ENTRY_FILE)) return null

    const deduped = []
    const seen = new Set()
    for (const [name, code] of files) {
      if (seen.has(name)) continue
      seen.add(name)
      deduped.push([name, code])
    }

    return {
      active:
        typeof parsed.active === 'string' &&
        deduped.some(([name]) => name === parsed.active)
          ? parsed.active
          : ENTRY_FILE,
      files: deduped,
    }
  } catch {
    return null
  }
}

const createExampleSnapshot = (exampleId) => {
  const example = getPlaygroundExample(exampleId)

  return {
    active: example.entry,
    files: cloneExampleFiles(example.files),
  }
}

const snapshotsEqual = (left, right) =>
  left.active === right.active &&
  left.files.length === right.files.length &&
  left.files.every(
    ([name, code], index) =>
      right.files[index]?.[0] === name && right.files[index]?.[1] === code
  )

const readInitialSnapshot = () => {
  state.exampleId = getExampleIdFromLocation()

  const parsed = parseSnapshot(window.location.hash.slice(1))
  if (parsed) {
    lastHash = window.location.hash.slice(1)
    return parsed
  }

  return {
    ...createExampleSnapshot(state.exampleId),
  }
}

const modelUri = (name) => monaco.Uri.parse(`file:///playground/${name}`)

const getFileState = (name) => state.files.find((file) => file.name === name)
const isLockedFile = (name) => name === ENTRY_FILE
const fileLanguage = (name) => (isCssFileName(name) ? 'css' : 'typescript')
const fileIconLabel = (name) => (isCssFileName(name) ? 'CSS' : 'TS')

const closeFileMenu = () => {
  state.menuFile = ''
}

const buildPlaygroundUrl = (hash = lastHash, exampleId = state.exampleId) => {
  const base = exampleId && exampleId !== starterExampleId
    ? playgroundExampleHref(exampleId)
    : window.location.pathname

  return hash ? `${base}#${hash}` : base
}

const getSplitBounds = () => {
  const split = document.getElementById('play-split')
  if (!split) return null
  const rect = split.getBoundingClientRect()
  return {
    left: rect.left,
    max: Math.max(MIN_SPLIT_PANE, rect.width - SPLITTER_SIZE - MIN_SPLIT_PANE),
  }
}

const syncResizeMode = () => {
  state.canResize = window.innerWidth > DESKTOP_SPLIT_BREAKPOINT

  if (!state.canResize) {
    state.resizing = false
    document.documentElement.style.cursor = ''
    document.body.style.userSelect = ''
    return
  }

  if (!state.editorWidth) return
  const bounds = getSplitBounds()
  if (!bounds) return
  if (state.editorWidth > bounds.max) {
    state.editorWidth = bounds.max
    editor?.layout()
  }
}

const splitStyle = () =>
  state.canResize && state.editorWidth
    ? `grid-template-columns:minmax(${MIN_SPLIT_PANE}px, ${state.editorWidth}px) ${SPLITTER_SIZE}px minmax(${MIN_SPLIT_PANE}px, 1fr)`
    : ''

const startResize = (event) => {
  if (!state.canResize) return
  const bounds = getSplitBounds()
  if (!bounds) return

  event.preventDefault()
  closeFileMenu()
  state.resizing = true
  document.documentElement.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  if (event.currentTarget instanceof Element && 'setPointerCapture' in event.currentTarget) {
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const move = (moveEvent) => {
    state.editorWidth = Math.max(
      MIN_SPLIT_PANE,
      Math.min(moveEvent.clientX - bounds.left, bounds.max)
    )
    editor?.layout()
  }

  const stop = () => {
    state.resizing = false
    document.documentElement.style.cursor = ''
    document.body.style.userSelect = ''
    if (
      event.currentTarget instanceof Element &&
      'releasePointerCapture' in event.currentTarget
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stop)
    window.removeEventListener('pointercancel', stop)
  }

  move(event)
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop)
  window.addEventListener('pointercancel', stop)
}

const writeHash = () => {
  const snapshot = createSnapshot()
  const baseSnapshot = createExampleSnapshot(state.exampleId)
  const encoded = snapshotsEqual(snapshot, baseSnapshot) ? '' : encodeText(JSON.stringify(snapshot))
  if (encoded !== lastHash) {
    history.replaceState(null, '', buildPlaygroundUrl(encoded))
    lastHash = encoded
  }
}

const scheduleHashSync = () => {
  clearTimeout(hashTimer)
  hashTimer = window.setTimeout(writeHash, 420)
}

const updateEditorTheme = () => {
  if (!monaco) return
  if (!monaco.__arrowDarkDefined) {
    monaco.editor.defineTheme('arrow-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#18181b',
        'editorGutter.background': '#18181b',
        'editorLineNumber.foreground': '#52525b',
        'editorLineNumber.activeForeground': '#a1a1aa',
      },
    })
    monaco.__arrowDarkDefined = true
  }
  monaco.editor.setTheme(
    document.documentElement.dataset.theme === 'dark' ? 'arrow-dark' : 'vs'
  )
  scheduleHtmlHighlight()
}

const flattenMessage = (message) => {
  if (typeof message === 'string') return message
  return [
    message.messageText,
    ...(message.next || []).map(flattenMessage),
  ].join('\n')
}

const createMarker = (model, diagnostic) => {
  const start = model.getPositionAt(diagnostic.start || 0)
  const end = model.getPositionAt(
    (diagnostic.start || 0) + (diagnostic.length || 0)
  )
  return {
    code: String(diagnostic.code),
    endColumn: end.column,
    endLineNumber: end.lineNumber,
    message: flattenMessage(diagnostic.messageText),
    severity: monaco.MarkerSeverity.Error,
    startColumn: start.column,
    startLineNumber: start.lineNumber,
  }
}

const buildModulePayload = async () => {
  const workerFactory = await monaco.languages.typescript.getTypeScriptWorker()
  const modules = {}
  const styles = []

  for (const file of state.files) {
    const model = models.get(file.name)
    if (!model) continue

    if (isCssFileName(file.name)) {
      monaco.editor.setModelMarkers(model, 'arrow-play', [])
      file.errors = 0
      styles.push({
        name: file.name,
        content: model.getValue(),
      })
      continue
    }

    const worker = await workerFactory(model.uri)
    const [syntactic, semantic, emit] = await Promise.all([
      worker.getSyntacticDiagnostics(model.uri.toString()),
      worker.getSemanticDiagnostics(model.uri.toString()),
      worker.getEmitOutput(model.uri.toString()),
    ])

    const markers = [...syntactic, ...semantic].map((diagnostic) =>
      createMarker(model, diagnostic)
    )
    monaco.editor.setModelMarkers(model, 'arrow-play', markers)
    file.errors = markers.length

    const output = emit.outputFiles.find((entry) => entry.name.endsWith('.js'))
    if (output) modules[file.name] = output.text
  }

  return { modules, styles }
}

const runPreview = (payload) => {
  pendingModules = payload
  if (!previewReady || !previewFrame?.contentWindow) return
  previewFrame.contentWindow.postMessage(
    { source: 'arrow-play-host', type: 'run', ...payload },
    '*'
  )
}

const compileAndRun = async () => {
  if (!editor || !monaco) return
  const currentCompile = ++compileId
  const payload = await buildModulePayload()
  if (currentCompile !== compileId) return
  if (!payload.modules[ENTRY_FILE]) return
  runPreview({ entry: ENTRY_FILE, ...payload })
}

const scheduleCompile = () => {
  clearTimeout(updateTimer)
  updateTimer = window.setTimeout(() => {
    compileAndRun().catch((error) => {
      const active = getFileState(state.activeFile)
      if (active) active.errors = 1
      if (editor?.getModel()) {
        monaco.editor.setModelMarkers(editor.getModel(), 'arrow-play', [
          {
            code: 'PLAY',
            endColumn: 1,
            endLineNumber: 1,
            message: error.message || String(error),
            severity: monaco.MarkerSeverity.Error,
            startColumn: 1,
            startLineNumber: 1,
          },
        ])
      }
    })
  }, 140)
}

const skipString = (source, index, quote) => {
  for (let i = index + 1; i < source.length; i++) {
    if (source[i] === '\\') {
      i++
      continue
    }
    if (source[i] === quote) return i + 1
  }
  return source.length
}

const skipLineComment = (source, index) => {
  const next = source.indexOf('\n', index + 2)
  return next === -1 ? source.length : next
}

const skipBlockComment = (source, index) => {
  const next = source.indexOf('*/', index + 2)
  return next === -1 ? source.length : next + 2
}

const skipTemplateLiteral = (source, index) => {
  for (let i = index + 1; i < source.length; i++) {
    if (source[i] === '\\') {
      i++
      continue
    }
    if (source[i] === '`') return i + 1
    if (source[i] === '$' && source[i + 1] === '{') {
      i = skipJsExpression(source, i + 2) - 1
    }
  }
  return source.length
}

const skipJsExpression = (source, index, regions) => {
  let depth = 0
  for (let i = index; i < source.length; i++) {
    const char = source[i]
    const tagLength = templateTagLength(source, i)

    if (tagLength) {
      i = scanTaggedTemplate(source, i + tagLength, regions) - 1
      continue
    }
    if (char === "'" || char === '"') {
      i = skipString(source, i, char) - 1
      continue
    }
    if (char === '`') {
      i = skipTemplateLiteral(source, i) - 1
      continue
    }
    if (char === '/' && source[i + 1] === '/') {
      i = skipLineComment(source, i) - 1
      continue
    }
    if (char === '/' && source[i + 1] === '*') {
      i = skipBlockComment(source, i) - 1
      continue
    }
    if (char === '{') {
      depth++
      continue
    }
    if (char === '}') {
      if (!depth) return i + 1
      depth--
    }
  }
  return source.length
}

const templateTagLength = (source, index) => {
  if (!source.startsWith('html`', index) && !source.startsWith('t`', index)) {
    return 0
  }
  const prev = source[index - 1]
  return prev && /[\w$.]/.test(prev) ? 0 : source[index] === 'h' ? 5 : 2
}

const scanTaggedTemplate = (source, index, regions) => {
  let segmentStart = index
  for (let i = index; i < source.length; i++) {
    if (source[i] === '$' && source[i + 1] === '{') {
      if (segmentStart < i) regions.push([segmentStart, i])
      i = skipJsExpression(source, i + 2, regions) - 1
      segmentStart = i + 1
      continue
    }
    if (source[i] === '`') {
      if (segmentStart < i) regions.push([segmentStart, i])
      return i + 1
    }
  }
  if (segmentStart < source.length) regions.push([segmentStart, source.length])
  return source.length
}

const collectHtmlTemplateRegions = (source) => {
  const regions = []
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    const tagLength = templateTagLength(source, i)
    if (tagLength) {
      i = scanTaggedTemplate(source, i + tagLength, regions) - 1
      continue
    }
    if (char === "'" || char === '"') {
      i = skipString(source, i, char) - 1
      continue
    }
    if (char === '`') {
      i = skipTemplateLiteral(source, i) - 1
      continue
    }
    if (char === '/' && source[i + 1] === '/') {
      i = skipLineComment(source, i) - 1
      continue
    }
    if (char === '/' && source[i + 1] === '*') {
      i = skipBlockComment(source, i) - 1
    }
  }
  return regions
}

const tokenizeHtmlSegment = (segment) => {
  const tokens = []
  const push = (start, end, className) => {
    if (end > start) tokens.push([start, end, className])
  }

  let i = 0
  while (i < segment.length) {
    if (segment.startsWith('<!--', i)) {
      const end = segment.indexOf('-->', i + 4)
      const next = end === -1 ? segment.length : end + 3
      push(i, next, 'play-html-comment')
      i = next
      continue
    }

    if (segment[i] !== '<') {
      i++
      continue
    }

    const next = segment[i + 1]
    if (!next || /[\s=]/.test(next)) {
      i++
      continue
    }

    let cursor = i
    if (segment.startsWith('</', cursor)) {
      push(cursor, cursor + 2, 'play-html-delimiter')
      cursor += 2
    } else {
      push(cursor, cursor + 1, 'play-html-delimiter')
      cursor++
    }

    const nameStart = cursor
    while (cursor < segment.length && /[A-Za-z0-9:_-]/.test(segment[cursor]))
      cursor++
    push(nameStart, cursor, 'play-html-tag')

    while (cursor < segment.length) {
      while (cursor < segment.length && /\s/.test(segment[cursor])) cursor++

      if (segment.startsWith('/>', cursor)) {
        push(cursor, cursor + 2, 'play-html-delimiter')
        cursor += 2
        break
      }
      if (segment[cursor] === '>') {
        push(cursor, cursor + 1, 'play-html-delimiter')
        cursor++
        break
      }

      const attrStart = cursor
      while (cursor < segment.length && !/[\s=>/]/.test(segment[cursor])) {
        cursor++
      }
      push(attrStart, cursor, 'play-html-attr-name')

      while (cursor < segment.length && /\s/.test(segment[cursor])) cursor++
      if (segment[cursor] !== '=') continue

      cursor++
      while (cursor < segment.length && /\s/.test(segment[cursor])) cursor++
      const valueStart = cursor
      const quote = segment[cursor]

      if (quote === '"' || quote === "'") {
        cursor++
        while (cursor < segment.length) {
          if (segment[cursor] === '\\') {
            cursor += 2
            continue
          }
          if (segment[cursor] === quote) {
            cursor++
            break
          }
          cursor++
        }
      } else {
        while (cursor < segment.length && !/[\s>]/.test(segment[cursor]))
          cursor++
      }
      push(valueStart, cursor, 'play-html-attr-value')
    }

    i = cursor
  }

  return tokens
}

const buildHtmlDecorations = (model) => {
  const source = model.getValue()
  const regions = collectHtmlTemplateRegions(source)
  const decorations = []

  for (const [startOffset, endOffset] of regions) {
    const segment = source.slice(startOffset, endOffset)
    for (const [localStart, localEnd, className] of tokenizeHtmlSegment(
      segment
    )) {
      const start = startOffset + localStart
      const end = startOffset + localEnd
      decorations.push({
        options: {
          inlineClassName: className,
        },
        range: new monaco.Range(
          model.getPositionAt(start).lineNumber,
          model.getPositionAt(start).column,
          model.getPositionAt(end).lineNumber,
          model.getPositionAt(end).column
        ),
      })
    }
  }

  return decorations
}

const applyHtmlHighlight = () => {
  if (!editor || !monaco || !htmlDecorations) return
  const model = editor.getModel()
  if (!model) return
  if (isCssFileName(state.activeFile)) {
    htmlDecorations.clear()
    return
  }
  htmlDecorations.set(buildHtmlDecorations(model))
}

const scheduleHtmlHighlight = () => {
  clearTimeout(highlightTimer)
  highlightTimer = window.setTimeout(applyHtmlHighlight, 30)
}

const switchFile = (name) => {
  if (!editor || name === state.activeFile) return

  viewStates.set(state.activeFile, editor.saveViewState())
  state.activeFile = name
  editor.setModel(models.get(name))
  const viewState = viewStates.get(name)
  if (viewState) editor.restoreViewState(viewState)
  editor.focus()
  scheduleHtmlHighlight()
  scheduleHashSync()
}

const restoreSnapshot = (snapshot) => {
  const nextNames = new Set(snapshot.files.map(([name]) => name))

  for (const [name, model] of models) {
    if (!nextNames.has(name)) {
      model.dispose()
      models.delete(name)
      viewStates.delete(name)
    }
  }

  const nextFiles = snapshot.files.map(([name, code]) => {
    let model = models.get(name)
    if (!model) {
      model = monaco.editor.createModel(code, fileLanguage(name), modelUri(name))
      models.set(name, model)
    } else if (model.getValue() !== code) {
      model.setValue(code)
    }
    return {
      errors: 0,
      name,
    }
  })

  state.files.splice(0, state.files.length, ...nextFiles)
  state.activeFile = nextFiles.some((file) => file.name === snapshot.active)
    ? snapshot.active
    : ENTRY_FILE

  if (editor) {
    editor.setModel(models.get(state.activeFile))
    const viewState = viewStates.get(state.activeFile)
    if (viewState) editor.restoreViewState(viewState)
    scheduleHtmlHighlight()
  }
}

const copyUrl = async () => {
  writeHash()
  await navigator.clipboard.writeText(window.location.href)
  state.copied = true
  window.setTimeout(() => {
    state.copied = false
  }, 1200)
}

const createFileTemplate = (name) => {
  if (isCssFileName(name)) {
    return `#app {\n  padding: 24px;\n}\n`
  }

  const base = name.replace(/\.ts$/, '')
  const exportName =
    base
      .replace(/(^|[-_])(\w)/g, (_, __, char) => char.toUpperCase())
      .replace(/[^A-Za-z0-9_$]/g, '') || 'Example'

  return `import { component, html } from '@arrow-js/core'

export const ${exportName} = component(() =>
  html\`<section>${exportName}</section>\`
)`
}

const createDuplicateName = (name) => {
  const dot = name.lastIndexOf('.')
  const stem = dot === -1 ? name : name.slice(0, dot)
  const ext = dot === -1 ? '' : name.slice(dot)
  let copyName = `${stem}-copy${ext}`
  let index = 2

  while (models.has(copyName)) {
    copyName = `${stem}-copy-${index}${ext}`
    index++
  }

  return copyName
}

const commitRename = (file, newName) => {
  newName = newName.trim()
  if (!/\.[A-Za-z]+$/.test(newName)) newName += '.ts'
  state.renaming = ''

  const isNew = !models.has(file.name)

  if (!isSupportedFileName(newName)) return isNew ? removeFile(file.name) : undefined
  if (newName !== file.name && models.has(newName))
    return isNew ? removeFile(file.name) : undefined

  if (isNew) {
    const model = monaco.editor.createModel(
      createFileTemplate(newName),
      fileLanguage(newName),
      modelUri(newName)
    )
    models.set(newName, model)
    file.name = newName
    switchFile(newName)
    scheduleHashSync()
    scheduleCompile()
    return
  }

  if (isLockedFile(file.name)) return
  if (newName === file.name) return

  const oldName = file.name
  const code = models.get(oldName)?.getValue() ?? ''
  const oldModel = models.get(oldName)
  if (oldModel) oldModel.dispose()
  models.delete(oldName)
  viewStates.delete(oldName)

  const newModel = monaco.editor.createModel(
    code,
    fileLanguage(newName),
    modelUri(newName)
  )
  models.set(newName, newModel)
  file.name = newName

  if (state.activeFile === oldName) {
    state.activeFile = newName
    editor.setModel(newModel)
  }
  scheduleHashSync()
  scheduleCompile()
}

const removeFile = (name) => {
  if (isLockedFile(name)) return
  const idx = state.files.findIndex((f) => f.name === name)
  if (idx === -1) return
  const nextActive =
    state.activeFile === name
      ? state.files[idx + 1]?.name || state.files[idx - 1]?.name || ENTRY_FILE
      : state.activeFile
  state.files.splice(idx, 1)
  const model = models.get(name)
  if (model) model.dispose()
  models.delete(name)
  viewStates.delete(name)
  if (state.menuFile === name) closeFileMenu()

  if (state.activeFile === name) {
    state.activeFile = nextActive
    if (editor && models.has(nextActive)) editor.setModel(models.get(nextActive))
  }

  scheduleHashSync()
  scheduleCompile()
}

const focusRenameInput = () => {
  requestAnimationFrame(() => {
    const el = document.querySelector('.play-rename-input')
    if (!el) return
    el.focus()
    const dot = el.value.lastIndexOf('.')
    if (dot > 0) el.setSelectionRange(0, dot)
  })
}

const startRename = (name) => {
  if (isLockedFile(name)) return
  closeFileMenu()
  state.renaming = name
  focusRenameInput()
}

const duplicateFile = (name) => {
  if (!monaco) return
  const source = models.get(name)
  if (!source) return

  const copyName = createDuplicateName(name)
  const copyModel = monaco.editor.createModel(
    source.getValue(),
    fileLanguage(copyName),
    modelUri(copyName)
  )
  const index = state.files.findIndex((file) => file.name === name)

  models.set(copyName, copyModel)
  state.files.splice(index + 1, 0, {
    errors: 0,
    name: copyName,
  })
  closeFileMenu()
  switchFile(copyName)
  scheduleHashSync()
  scheduleCompile()
}

const addFile = () => {
  if (!monaco) return
  closeFileMenu()
  const placeholder = 'Untitled.ts'
  state.files.push({ errors: 0, name: placeholder })
  state.renaming = placeholder
  focusRenameInput()
}

const openFileMenu = (event, name) => {
  event.preventDefault()
  state.renaming = ''
  state.menuFile = name
  state.menuX = Math.max(8, Math.min(event.clientX, window.innerWidth - 168))
  state.menuY = Math.max(8, Math.min(event.clientY, window.innerHeight - 120))
}

const onFrameMessage = (event) => {
  const data = event.data
  if (!data || data.source !== 'arrow-play-preview') return
  if (data.type === 'frame-ready') {
    previewReady = true
    if (pendingModules) runPreview(pendingModules)
  }
}

const syncFromLocation = () => {
  if (!monaco) return

  const nextExampleId = getExampleIdFromLocation()
  const incomingHash = window.location.hash.slice(1)
  const snapshot = parseSnapshot(incomingHash) ?? createExampleSnapshot(nextExampleId)

  state.exampleId = nextExampleId
  applyingHash = true
  restoreSnapshot(snapshot)
  applyingHash = false
  lastHash = parseSnapshot(incomingHash) ? incomingHash : ''
  scheduleCompile()
}

const loadMonaco = () => {
  if (window.monaco?.editor) return Promise.resolve(window.monaco)
  if (monacoLoader) return monacoLoader

  monacoLoader = new Promise((resolve, reject) => {
    window.MonacoEnvironment = {
      getWorkerUrl() {
        return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
          self.MonacoEnvironment = { baseUrl: '${MONACO_BASE}/' };
          importScripts('${MONACO_URL}/base/worker/workerMain.js');
        `)}`
      },
    }

    const script = document.createElement('script')
    script.src = `${MONACO_URL}/loader.js`
    script.onload = () => {
      window.require.config({ paths: { vs: MONACO_URL } })
      window.require(
        ['vs/editor/editor.main'],
        () => resolve(window.monaco),
        reject
      )
    }
    script.onerror = () => reject(new Error('Failed to load Monaco'))
    document.head.append(script)
  })

  return monacoLoader
}

const initMonaco = async () => {
  monaco = await loadMonaco()
  updateEditorTheme()

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
    allowImportingTsExtensions: true,
    allowNonTsExtensions: true,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    noEmitOnError: false,
    strict: true,
    target: monaco.languages.typescript.ScriptTarget.ES2022,
    lib: ['dom', 'dom.iterable', 'es2022'],
  })
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
  })
  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true)
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    arrowTypes,
    'file:///node_modules/@arrow-js/core/index.d.ts'
  )

  restoreSnapshot(readInitialSnapshot())

  editor = monaco.editor.create(document.getElementById('play-editor'), {
    automaticLayout: true,
    model: models.get(state.activeFile),
    minimap: { enabled: false },
    padding: { bottom: 12, top: 12 },
    fontSize: 14,
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    tabSize: 2,
  })
  htmlDecorations = editor.createDecorationsCollection([])

  editor.onDidChangeModelContent(() => {
    if (applyingHash) return
    scheduleHtmlHighlight()
    scheduleHashSync()
    scheduleCompile()
  })

  scheduleHtmlHighlight()
  scheduleCompile()
}

const shell = html`
  <div class="play-shell">
    <header class="play-topbar">
      <a class="play-brand" href="/" aria-label="ArrowJS home">
        <img src="${logoUrl}" alt="ArrowJS" />
      </a>
      <div class="play-actions">
        <button data-tone="primary" @click="${copyUrl}">
          ${() => (state.copied ? 'Copied' : 'Copy URL')}
        </button>
        <a class="play-link" href="/docs/">Docs</a>
      </div>
    </header>
    <main class="play-workspace">
      <aside class="play-explorer">
        <div class="play-explorer-header">
          <span class="play-explorer-title">Files</span>
          <button
            class="play-icon-button"
            @click="${addFile}"
            aria-label="New file"
          >
            +
          </button>
        </div>
        <div class="play-explorer-list">
          ${() =>
            state.files.map(
              (file) => html`<div
                class="play-file"
                data-active="${() => String(file.name === state.activeFile)}"
                @click="${() => {
                  closeFileMenu()
                  if (state.renaming !== file.name) switchFile(file.name)
                }}"
                @contextmenu="${(event) => openFileMenu(event, file.name)}"
                @dblclick="${(e) => {
                  e.preventDefault()
                  startRename(file.name)
                }}"
              >
                <span class="play-file-main">
                  <span class="play-file-icon">${fileIconLabel(file.name)}</span>
                  ${() =>
                    state.renaming === file.name
                      ? html`<input
                          class="play-rename-input"
                          value="${file.name}"
                          @blur="${(e) => commitRename(file, e.target.value)}"
                          @keydown="${(e) => {
                            if (e.key === 'Enter') e.target.blur()
                            if (e.key === 'Escape') {
                              state.renaming = ''
                              if (!models.has(file.name)) removeFile(file.name)
                            }
                          }}"
                        />`
                      : html`<span class="play-file-name">${file.name}</span>`}
                </span>
                ${() =>
                  file.errors && state.renaming !== file.name
                    ? html`<span class="play-file-badge"
                        >${() => file.errors}</span
                      >`
                    : ''}
          </div>`
            )}
        </div>
      </aside>
      <div id="play-split" class="play-split" style="${splitStyle}">
        <section class="play-editor-pane">
          <div class="play-pane-header">
            <span class="play-pane-tab">
              <span class="play-file-icon">${() => fileIconLabel(state.activeFile)}</span>
              ${() => state.activeFile}
            </span>
          </div>
          <div id="play-editor" class="play-editor"></div>
        </section>
        <div
          class="play-splitter"
          data-active="${() => String(state.resizing)}"
          @pointerdown="${startResize}"
          aria-label="Resize editor and preview panels"
          role="separator"
        ></div>
        <section class="play-preview-pane">
          <div class="play-pane-header">
            <span class="play-pane-label">Preview</span>
          </div>
          <iframe
            id="play-preview"
            class="play-preview"
            title="Arrow Playground Preview"
            src="${new URL('./preview.html', window.location.href).pathname}"
          ></iframe>
        </section>
        ${() =>
          state.resizing
            ? html`<div class="play-resize-capture"></div>`
            : ''}
      </div>
    </main>
    ${() =>
      state.menuFile
        ? html`<div
            class="play-context-menu"
            style="${() => `left:${state.menuX}px; top:${state.menuY}px`}"
            @contextmenu="${(event) => event.preventDefault()}"
          >
            <button
              class="play-context-item"
              data-disabled="${() => String(isLockedFile(state.menuFile))}"
              @click="${() => {
                if (isLockedFile(state.menuFile)) return
                startRename(state.menuFile)
              }}"
            >
              Rename
            </button>
            <button
              class="play-context-item"
              @click="${() => duplicateFile(state.menuFile)}"
            >
              Duplicate
            </button>
            <button
              class="play-context-item"
              data-danger="true"
              data-disabled="${() => String(isLockedFile(state.menuFile))}"
              @click="${() => {
                if (isLockedFile(state.menuFile)) return
                const name = state.menuFile
                closeFileMenu()
                removeFile(name)
              }}"
            >
              Delete
            </button>
          </div>`
        : ''}
  </div>
`

shell(document.getElementById('app'))

previewFrame = document.getElementById('play-preview')

window.addEventListener('message', onFrameMessage)
window.addEventListener('hashchange', syncFromLocation)
window.addEventListener('popstate', syncFromLocation)
window.addEventListener('mousedown', (event) => {
  if (!state.menuFile) return
  if (event.target instanceof Element && event.target.closest('.play-context-menu'))
    return
  closeFileMenu()
})
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeFileMenu()
})
window.addEventListener('resize', () => {
  syncResizeMode()
  editor?.layout()
})
new MutationObserver(updateEditorTheme).observe(document.documentElement, {
  attributeFilter: ['data-theme'],
  attributes: true,
})

syncResizeMode()
initMonaco().catch((error) => {
  window.alert(error.message || String(error))
})
