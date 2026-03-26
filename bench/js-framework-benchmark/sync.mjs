import { ensureBenchmarkRepo, syncArrowBenchmark } from './lib.mjs'

ensureBenchmarkRepo()
syncArrowBenchmark()
console.log('Synced the npm-backed Arrow benchmark source into the official js-framework-benchmark Arrow entry')
