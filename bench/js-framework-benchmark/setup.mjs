import {
  benchmarkRepoDir,
  benchmarkTag,
  buildArrowBenchmark,
  ensureBenchmarkRepo,
  syncArrowBenchmark,
} from './lib.mjs'

ensureBenchmarkRepo({ install: true })
syncArrowBenchmark()
buildArrowBenchmark()
console.log(`Benchmark repo ready at ${benchmarkRepoDir} (${benchmarkTag})`)
