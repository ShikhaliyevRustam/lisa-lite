import { readFileSync } from 'fs'
import { answerQuestion } from '../src/generate.ts'

const id = Number(process.argv[2])
const saved = JSON.parse(readFileSync('eval/results.json', 'utf8'))
const row = saved.rows.find((r: any) => r.id === id)
if (!row) {
    console.error(`No question ${id} in eval/results.json`)
    process.exit(1)
}

const result = await answerQuestion(row.question)
console.log('Q:', row.question)
console.log('A:', result.answer)

for (const c of result.verifiedCitations) {
    if (!c.valid || c.quoteSupported !== false) continue
    const passage = result.sources.find(
        (s: any) => s.document_id === c.documentId && s.start_line === c.startLine && s.end_line === c.endLine
    )
    const sentences = result.answer.match(new RegExp(`[^.]*\\[${c.number}\\][^.]*\\.`, 'g')) ?? []
    console.log(`\n--- [${c.number}] flagged unverified (${c.filename}, lines ${c.startLine}-${c.endLine}) ---`)
    console.log('CITING SENTENCE(S):', sentences.join(' ').trim())
    console.log('CITED PASSAGE:', passage?.content)
}
process.exit(0)