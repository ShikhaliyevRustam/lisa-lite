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

    // Only chunks from fully processed documents are searchable.
    const semanticResults = await sql`
        SELECT c.id, c.breadcrumb, c.content, c.document_id, c.start_line, c.end_line, d.filename,
               c.embedding <=> ${JSON.stringify(queryEmbedding)} AS score
        FROM chunks c
            JOIN documents d ON d.id = c.document_id
        WHERE c.embedding IS NOT NULL AND d.status = 'ready'
        ORDER BY score
            LIMIT ${limit}
    `

    const keywordResults = await sql`
        SELECT c.id, c.breadcrumb, c.content, c.document_id, c.start_line, c.end_line, d.filename,
               ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', ${query})) AS score
        FROM chunks c
                 JOIN documents d ON d.id = c.document_id
        WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', ${query})
          AND d.status = 'ready'
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