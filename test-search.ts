import postgres from 'postgres'
import OpenAI from 'openai'

const sql = postgres(process.env.DATABASE_URL!)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function search(query: string) {
    const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
    })
    const queryEmbedding = embeddingResponse.data[0].embedding

    const results = await sql`
    SELECT breadcrumb, content, document_id,
           embedding <=> ${JSON.stringify(queryEmbedding)} AS distance
    FROM chunks
    WHERE embedding IS NOT NULL
    ORDER BY distance
    LIMIT 5
  `

    for (const row of results) {
        console.log(`[distance: ${row.distance.toFixed(4)}] (doc ${row.document_id}) ${row.breadcrumb}`)
        console.log(row.content.slice(0, 100))
        console.log('---')
    }
}

search(process.argv[2])