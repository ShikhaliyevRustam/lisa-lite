import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

async function search(query: string) {
    const results = await sql`
    SELECT breadcrumb, content, document_id,
           ts_rank(to_tsvector('english', content), plainto_tsquery('english', ${query})) AS rank
    FROM chunks
    WHERE to_tsvector('english', content) @@ plainto_tsquery('english', ${query})
    ORDER BY rank DESC
    LIMIT 5
  `

    for (const row of results) {
        console.log(`[rank: ${row.rank.toFixed(4)}] (doc ${row.document_id}) ${row.breadcrumb}`)
        console.log(row.content.slice(0, 100))
        console.log('---')
    }
}

search(process.argv[2])