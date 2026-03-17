const officialKeyed = 'keyed/arrowjs'
const officialNonKeyed = 'non-keyed/arrowjs'

export const presetMap = {
  smoke: {
    frameworks: [
      officialKeyed,
      'keyed/vanillajs',
      officialNonKeyed,
      'non-keyed/vanillajs',
    ],
    benchmarks: ['01_'],
  },
  core: {
    frameworks: [
      officialKeyed,
      'keyed/vanillajs',
      'keyed/redom',
      'keyed/lit',
      'keyed/mithril',
      'keyed/solid',
      officialNonKeyed,
      'non-keyed/vanillajs',
      'non-keyed/redom',
      'non-keyed/lit',
      'non-keyed/vue',
      'non-keyed/uhtml',
    ],
    benchmarks: ['01_', '05_', '07_', '09_'],
  },
  targets: {
    frameworks: [
      officialKeyed,
      'keyed/vanillajs',
      'keyed/solid',
      'keyed/vue',
      officialNonKeyed,
      'non-keyed/vanillajs',
      'non-keyed/vue',
    ],
    benchmarks: ['01_', '02_', '03_', '04_', '05_', '06_', '07_', '08_', '09_'],
  },
  breadth: {
    frameworks: [
      officialKeyed,
      'keyed/vanillajs',
      'keyed/redom',
      'keyed/lit',
      'keyed/mithril',
      'keyed/solid',
      'keyed/preact-hooks',
      'keyed/vue',
      officialNonKeyed,
      'non-keyed/vanillajs',
      'non-keyed/redom',
      'non-keyed/lit',
      'non-keyed/vue',
      'non-keyed/uhtml',
      'non-keyed/mikado',
    ],
    benchmarks: ['01_', '02_', '03_', '04_', '05_', '06_', '07_', '08_', '09_'],
  },
}
