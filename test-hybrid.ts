import { hybridSearch } from './hybridSearch.ts'

const results = await hybridSearch(process.argv[2])
for (const r of results) {
    console.log(`[${r.source}] (doc ${r.document_id}) ${r.breadcrumb}`)
}