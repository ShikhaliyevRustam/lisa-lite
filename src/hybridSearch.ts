import postgres from 'postgres'
import OpenAI from 'openai'

const sql = postgres(process.env.DATABASE_URL!)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function hybridSearch(query: string, limit = 5) {
    const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
    })
    const queryEmbedding = embeddingResponse.data[0].embedding

    const semanticResults = await sql`
    SELECT id, breadcrumb, content, document_id, start_line, end_line,
           embedding <=> ${JSON.stringify(queryEmbedding)} AS score
    FROM chunks
    WHERE embedding IS NOT NULL
    ORDER BY score
    LIMIT ${limit}
  `

    const keywordResults = await sql`
    SELECT id, breadcrumb, content, document_id, start_line, end_line,
           ts_rank(to_tsvector('english', content), plainto_tsquery('english', ${query})) AS score
    FROM chunks
    WHERE to_tsvector('english', content) @@ plainto_tsquery('english', ${query})
    ORDER BY score DESC
    LIMIT ${limit}
  `

    const combined = new Map()
    for (const row of semanticResults) combined.set(row.id, { ...row, source: 'semantic' })
    for (const row of keywordResults) {
        if (!combined.has(row.id)) combined.set(row.id, { ...row, source: 'keyword' })
        else combined.get(row.id).source = 'both'
    }

    return Array.from(combined.values())
}