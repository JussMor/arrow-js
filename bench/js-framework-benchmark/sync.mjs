import { ensureBenchmarkRepo, syncArrowBenchmark } from './lib.mjs'

ensureBenchmarkRepo()
syncArrowBenchmark()
console.log('Synced compiled Arrow into the official js-framework-benchmark Arrow entry')
