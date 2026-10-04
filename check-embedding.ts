import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

async function main() {
    const [chunk] = await sql`SELECT id, document_id, content, embedding FROM chunks WHERE document_id = 2`
    console.log('Content:', chunk.content)
    console.log('Embedding is null?', chunk.embedding === null)
    console.log('Embedding type:', typeof chunk.embedding)
    console.log('First 50 chars of embedding:', String(chunk.embedding).slice(0, 50))
}

main()