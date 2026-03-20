import { readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'

import { rootDir } from './lib.mjs'

const defaultTraceDir = join(
  rootDir,
  '.cache/js-framework-benchmark-chrome142/webdriver-ts/traces'
)
const interestingEvents = [
  'RunTask',
  'EvaluateScript',
  'FunctionCall',
  'EventDispatch',
  'Layout',
  'UpdateLayoutTree',
  'PrePaint',
  'Paint',
]

let contains = ''
let tracePath = ''
let traceDir = defaultTraceDir
let top = 12

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i]
  if (arg === '--') continue
  if (arg === '--trace') tracePath = process.argv[++i] ?? tracePath
  else if (arg === '--contains') contains = process.argv[++i] ?? contains
  else if (arg === '--dir') traceDir = process.argv[++i] ?? traceDir
  else if (arg === '--top') top = Number(process.argv[++i] ?? top) || top
  else if (!tracePath) tracePath = arg
}

if (!tracePath && contains) {
  const match = readdirSync(traceDir)
    .filter((file) => file.endsWith('.json') && file.includes(contains))
    .sort()
    .at(-1)
  if (match) tracePath = join(traceDir, match)
}

if (!tracePath) {
  throw new Error('Pass --trace <file> or --contains <substring>.')
}

const trace = JSON.parse(readFileSync(tracePath, 'utf8'))
const events = trace.traceEvents ?? []
const threadNames = new Map()
const runTaskTotals = new Map()

for (const event of events) {
  if (event.name === 'thread_name') {
    threadNames.set(`${event.pid}:${event.tid}`, event.args?.name)
    continue
  }
  if (
    event.name === 'RunTask' &&
    event.ph === 'X' &&
    threadNames.get(`${event.pid}:${event.tid}`) === 'CrRendererMain'
  ) {
    const key = `${event.pid}:${event.tid}`
    runTaskTotals.set(key, (runTaskTotals.get(key) ?? 0) + (event.dur ?? 0))
  }
}

const rendererKey = [...runTaskTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

if (!rendererKey) {
  throw new Error(`No CrRendererMain thread found in ${basename(tracePath)}.`)
}

const [pid, tid] = rendererKey.split(':').map(Number)
const timelineTotals = new Map()
let gcTotal = 0

for (const event of events) {
  if (event.pid !== pid || event.tid !== tid || event.ph !== 'X') continue
  if (interestingEvents.includes(event.name)) {
    timelineTotals.set(
      event.name,
      (timelineTotals.get(event.name) ?? 0) + (event.dur ?? 0) / 1000
    )
  }
  if (String(event.name).includes('GC')) {
    gcTotal += (event.dur ?? 0) / 1000
  }
}

const nodes = new Map()
const samples = []
const timeDeltas = []

for (const event of events) {
  if (event.pid !== pid) continue
  if (event.name === 'Profile') {
    const profileNodes = event.args?.data?.cpuProfile?.nodes ?? []
    for (const node of profileNodes) nodes.set(node.id, node)
  } else if (event.name === 'ProfileChunk') {
    const chunk = event.args?.data?.cpuProfile ?? {}
    for (const node of chunk.nodes ?? []) nodes.set(node.id, node)
    samples.push(...(chunk.samples ?? []))
    timeDeltas.push(...(chunk.timeDeltas ?? []))
  }
}

const selfTime = new Map()
const sampleCounts = new Map()

for (let i = 0; i < samples.length; i++) {
  const node = nodes.get(samples[i])
  if (!node) continue
  const frame = node.callFrame ?? {}
  const fn = frame.functionName || '(anonymous)'
  const url = frame.url ? ` ${basename(frame.url)}` : ''
  const key = `${fn}${url}`
  sampleCounts.set(key, (sampleCounts.get(key) ?? 0) + 1)
  selfTime.set(key, (selfTime.get(key) ?? 0) + (timeDeltas[i] ?? 0) / 1000)
}

console.log(`Trace: ${tracePath}`)
console.log(`Renderer thread: ${rendererKey}`)
console.log('\nTimeline (ms)')
for (const name of interestingEvents) {
  const total = timelineTotals.get(name)
  if (total) console.log(`${name.padEnd(18)} ${total.toFixed(1)}`)
}
console.log(`GC`.padEnd(18), gcTotal.toFixed(1))

const timedSamples = [...selfTime.values()].some((total) => total > 0)

if (timedSamples) {
  console.log('\nTop sampled self time (ms)')
  for (const [name, total] of [...selfTime.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)) {
    console.log(`${name.padEnd(36)} ${total.toFixed(3)}`)
  }
} else {
  console.log('\nTop sampled frames (count)')
  for (const [name, count] of [...sampleCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)) {
    console.log(`${name.padEnd(36)} ${count}`)
  }
}
