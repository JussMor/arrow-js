import { html, reactive } from '@arrow-js/core'

// --- SVG Sparkline helpers ---

function sparklinePath(data: number[], w: number, h: number, pad = 2): string {
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1
  const step = (w - pad * 2) / (data.length - 1)
  return data
    .map((v, i) => {
      const x = pad + i * step
      const y = pad + (h - pad * 2) * (1 - (v - min) / range)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function sparklineArea(data: number[], w: number, h: number, pad = 2): string {
  return `${sparklinePath(data, w, h, pad)} L${(w - pad).toFixed(1)},${h} L${pad},${h} Z`
}

// ============================================================
// Scenario 1 — HVAC Quote Comparison
// ============================================================

interface Quote {
  vendor: string
  price: number
  seer: number
  warranty: number
}

const quotes: Quote[] = [
  { vendor: 'CoolAir Pro', price: 8200, seer: 16, warranty: 10 },
  { vendor: 'ClimateCraft', price: 7400, seer: 15, warranty: 5 },
  { vendor: 'AirFlow Plus', price: 9100, seer: 18, warranty: 12 },
]

type SortKey = 'price' | 'efficiency' | 'warranty'

function bestVendor(key: SortKey): string {
  if (key === 'price') return quotes.reduce((b, q) => (q.price < b.price ? q : b)).vendor
  if (key === 'efficiency') return quotes.reduce((b, q) => (q.seer > b.seer ? q : b)).vendor
  return quotes.reduce((b, q) => (q.warranty > b.warranty ? q : b)).vendor
}

function sorted(key: SortKey): Quote[] {
  const s = [...quotes]
  if (key === 'price') s.sort((a, b) => a.price - b.price)
  else if (key === 'efficiency') s.sort((a, b) => b.seer - a.seer)
  else s.sort((a, b) => b.warranty - a.warranty)
  return s
}

export function HvacComparison() {
  const st = reactive({ sortBy: 'price' as SortKey })
  const opts: { key: SortKey; label: string }[] = [
    { key: 'price', label: 'Price' },
    { key: 'efficiency', label: 'Efficiency' },
    { key: 'warranty', label: 'Warranty' },
  ]

  return html`
    <div class="space-y-3">
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mr-0.5">Sort by</span>
        ${opts.map(
          (o) => html`
            <button
              @click="${() => {
                st.sortBy = o.key
              }}"
              class="${() =>
                `px-2.5 py-1 text-[11px] font-semibold rounded-full transition-all cursor-pointer outline-none ` +
                (st.sortBy === o.key
                  ? 'bg-arrow-500 text-zinc-900 shadow-sm'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700')}"
            >
              ${o.label}
            </button>
          `
        )}
      </div>

      <div class="grid grid-cols-3 gap-2">
        ${() =>
          sorted(st.sortBy).map((q) => {
            const best = q.vendor === bestVendor(st.sortBy)
            return html`
              <div
                class="${`relative rounded-lg border p-3 transition-all ${
                  best
                    ? 'border-arrow-500/50 bg-arrow-500/5 dark:bg-arrow-500/10 shadow-sm shadow-arrow-500/10'
                    : 'border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-800/50'
                }`}"
              >
                ${best
                  ? html`<div
                      class="absolute -top-2 left-3 px-2 py-0.5 bg-arrow-500 text-zinc-900 text-[8px] font-bold uppercase tracking-wider rounded-full leading-none"
                    >
                      Best Value
                    </div>`
                  : ''}
                <div class="${'text-[11px] font-semibold text-zinc-700 dark:text-zinc-300' + (best ? ' mt-1' : '')}">${q.vendor}</div>
                <div class="mt-1.5 text-lg font-extrabold tracking-tight text-zinc-900 dark:text-white">
                  $${q.price.toLocaleString()}
                </div>
                <div class="mt-2 space-y-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                  <div class="flex justify-between">
                    <span>SEER</span>
                    <span class="font-semibold text-zinc-700 dark:text-zinc-300">${q.seer}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Warranty</span>
                    <span class="font-semibold text-zinc-700 dark:text-zinc-300">${q.warranty} yr</span>
                  </div>
                </div>
              </div>
            `
          })}
      </div>
    </div>
  `
}

// ============================================================
// Scenario 2 — API Metrics Dashboard
// ============================================================

type TimeRange = '1h' | '24h' | '7d'

const dashData: Record<
  TimeRange,
  Record<string, { value: string; trend: string; up: boolean; spark: number[] }>
> = {
  '1h': {
    requests: { value: '1,247/m', trend: '+12%', up: true, spark: [80,92,85,110,95,120,105,135,128,142,130,147] },
    latency:  { value: '45 ms',   trend: '-8%',  up: false, spark: [62,58,55,52,48,51,46,44,47,43,45,42] },
    errors:   { value: '0.12%',   trend: '-23%', up: false, spark: [30,25,20,18,22,15,13,14,11,12,13,12] },
  },
  '24h': {
    requests: { value: '982/m',  trend: '+5%',  up: true, spark: [60,70,85,95,110,130,120,100,90,85,95,105] },
    latency:  { value: '52 ms',  trend: '-3%',  up: false, spark: [58,55,60,54,52,50,53,51,49,52,50,48] },
    errors:   { value: '0.18%',  trend: '-15%', up: false, spark: [35,30,28,25,22,20,19,17,18,16,18,17] },
  },
  '7d': {
    requests: { value: '876/m',  trend: '+18%', up: true, spark: [50,55,60,65,70,72,78,82,85,88,90,95] },
    latency:  { value: '58 ms',  trend: '-12%', up: false, spark: [70,68,65,62,60,58,56,55,54,56,55,53] },
    errors:   { value: '0.22%',  trend: '-31%', up: false, spark: [50,45,40,38,35,30,28,25,24,22,21,20] },
  },
}

const metrics = [
  { key: 'requests', label: 'Requests', color: '#22c55e' },
  { key: 'latency', label: 'P95 Latency', color: '#3b82f6' },
  { key: 'errors', label: 'Error Rate', color: '#f97316' },
] as const

export function ApiDashboard() {
  const st = reactive({ range: '24h' as TimeRange })
  const ranges: TimeRange[] = ['1h', '24h', '7d']

  return html`
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">API Metrics</span>
        <div class="flex gap-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-md p-0.5">
          ${ranges.map(
            (r) => html`
              <button
                @click="${() => {
                  st.range = r
                }}"
                class="${() =>
                  `px-2 py-0.5 text-[10px] font-semibold rounded transition-all cursor-pointer outline-none ` +
                  (st.range === r
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300')}"
              >
                ${r}
              </button>
            `
          )}
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2">
        ${metrics.map((m) => {
          const gradId = `hero-sg-${m.key}`
          const gradFill = `url(#${gradId})`
          return html`
            <div class="rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-white dark:bg-zinc-800/50 p-2.5 overflow-hidden">
              <div class="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">${m.label}</div>
              <div class="mt-1 flex items-baseline gap-1.5">
                <span class="text-sm font-extrabold tracking-tight text-zinc-900 dark:text-white">${() => dashData[st.range][m.key].value}</span>
                <span
                  class="${() =>
                    `text-[10px] font-semibold ${dashData[st.range][m.key].up ? 'text-emerald-500' : 'text-blue-500'}`}"
                >
                  ${() => dashData[st.range][m.key].trend}
                </span>
              </div>
              <svg class="mt-1.5 w-full h-7" viewBox="0 0 120 28" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="${m.color}" stop-opacity="0.15" />
                    <stop offset="100%" stop-color="${m.color}" stop-opacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="${() => sparklineArea(dashData[st.range][m.key].spark, 120, 28)}"
                  fill="${gradFill}"
                />
                <path
                  d="${() => sparklinePath(dashData[st.range][m.key].spark, 120, 28)}"
                  fill="none"
                  stroke="${m.color}"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  vector-effect="non-scaling-stroke"
                />
              </svg>
            </div>
          `
        })}
      </div>
    </div>
  `
}

// ============================================================
// Scenario 3 — Coffee Order Builder (overflow demo)
// ============================================================

const drinks = ['Latte', 'Cappuccino', 'Americano', 'Cold Brew', 'Matcha Latte']
const sizes = ['S', 'M', 'L'] as const
const addOns = [
  { id: 'shot', label: 'Extra Shot' },
  { id: 'oat', label: 'Oat Milk' },
  { id: 'vanilla', label: 'Vanilla' },
  { id: 'whip', label: 'Whipped Cream' },
]

export function CoffeeBuilder() {
  const st = reactive({
    drink: '',
    open: false,
    size: 'M' as (typeof sizes)[number],
    adds: [] as string[],
  })

  function toggleAdd(id: string) {
    const i = st.adds.indexOf(id)
    if (i === -1) st.adds.push(id)
    else st.adds.splice(i, 1)
  }

  return html`
    <div class="space-y-3 overflow-visible">
      <!-- Drink selector (overflow demo) -->
      <div class="relative overflow-visible">
        <label class="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Drink</label>
        <button
          @click="${() => {
            st.open = !st.open
          }}"
          class="mt-1 w-full flex items-center justify-between px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-left text-sm cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors outline-none"
        >
          <span class="${() => (st.drink ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500')}">
            ${() => st.drink || 'Select a drink\u2026'}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            class="text-zinc-400 flex-shrink-0"
          >
            <path d="M3 5l3 3 3-3" />
          </svg>
        </button>

        <!-- Dropdown — intentionally overflows the chat bubble -->
        <div
          class="${() =>
            `absolute left-0 right-0 mt-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl z-[60] transition-all origin-top ` +
            (st.open ? 'opacity-100 scale-y-100' : 'opacity-0 scale-y-95 pointer-events-none')}"
        >
          ${drinks.map(
            (d) => html`
              <button
                @click="${() => {
                  st.drink = d
                  st.open = false
                }}"
                class="${() =>
                  `w-full text-left px-3 py-2 text-sm cursor-pointer transition-colors first:rounded-t-lg last:rounded-b-lg outline-none ` +
                  (st.drink === d
                    ? 'bg-arrow-500/10 text-arrow-600 dark:text-arrow-400 font-medium'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700/50')}"
              >
                ${d}
              </button>
            `
          )}
        </div>

        <!-- Overflow tooltip -->
        <div
          class="${() =>
            (st.open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1') +
            ' absolute -right-2 top-full mt-[11.5rem] transition-all duration-300 pointer-events-none z-[70]'}"
        >
          <div
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-arrow-500/10 dark:bg-arrow-500/15 border border-arrow-500/20 dark:border-arrow-500/30 text-[9px] font-semibold text-arrow-600 dark:text-arrow-400 whitespace-nowrap backdrop-blur-sm"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.3">
              <circle cx="5" cy="5" r="3.5" />
              <path d="M5 3.5v2M5 7h.01" />
            </svg>
            Rendered inline — no iframe clipping
          </div>
        </div>
      </div>

      <!-- Size pills -->
      <div>
        <label class="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Size</label>
        <div class="mt-1 flex gap-1.5">
          ${sizes.map(
            (s) => html`
              <button
                @click="${() => {
                  st.size = s
                }}"
                class="${() =>
                  `flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer outline-none ` +
                  (st.size === s
                    ? 'border-arrow-500 bg-arrow-500/10 text-arrow-600 dark:text-arrow-400'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600')}"
              >
                ${s}
              </button>
            `
          )}
        </div>
      </div>

      <!-- Add-on chips -->
      <div>
        <label class="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Add-ons</label>
        <div class="mt-1 flex flex-wrap gap-1.5">
          ${addOns.map(
            (a) => html`
              <button
                @click="${() => toggleAdd(a.id)}"
                class="${() =>
                  `px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all cursor-pointer outline-none ` +
                  (st.adds.includes(a.id)
                    ? 'border-arrow-500 bg-arrow-500/10 text-arrow-600 dark:text-arrow-400'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600')}"
              >
                ${() => (st.adds.includes(a.id) ? '\u2713 ' : '+ ')}${a.label}
              </button>
            `
          )}
        </div>
      </div>
    </div>
  `
}

// ============================================================
// Scenario registry
// ============================================================

export interface ChatMessage {
  role: 'user' | 'agent'
  text: string
}

export interface Scenario {
  id: string
  label: string
  messages: ChatMessage[]
  ui: () => ReturnType<typeof html>
}

export const scenarios: Scenario[] = [
  {
    id: 'hvac',
    label: 'Comparing Quotes',
    messages: [
      { role: 'user', text: "Here are the 3 HVAC quotes. Which one\u2019s the best deal?" },
      { role: 'agent', text: "I\u2019ve broken down the key details from each quote. Here\u2019s a side-by-side:" },
    ],
    ui: HvacComparison,
  },
  {
    id: 'dashboard',
    label: 'API Monitoring',
    messages: [
      { role: 'user', text: "How\u2019s the API doing after yesterday\u2019s deploy?" },
      { role: 'agent', text: "I pulled your latest metrics. Here\u2019s a quick view:" },
    ],
    ui: ApiDashboard,
  },
  {
    id: 'coffee',
    label: 'Team Coffee Order',
    messages: [
      { role: 'user', text: 'Can you put together a coffee order for the team meeting?' },
      { role: 'agent', text: "Here\u2019s a builder \u2014 pick drinks and customize:" },
    ],
    ui: CoffeeBuilder,
  },
]
