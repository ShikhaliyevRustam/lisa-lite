import { hybridSearch } from '../src/hybridSearch.ts'
import { answerQuestion } from '../src/generate.ts'

const chunks = await hybridSearch(process.argv[2], 5)
console.log('RETRIEVED CHUNKS:', chunks.length)
for (const c of chunks) {
    console.log('-', c.breadcrumb, '|', c.content.slice(0, 60))
}

const result = await answerQuestion(process.argv[2])
console.log('\nANSWER:', JSON.stringify(result.answer))
console.log('CONFIDENCE:', result.confidence)
console.log('\nVERIFIED CITATIONS:')
console.log(result.verifiedCitations)