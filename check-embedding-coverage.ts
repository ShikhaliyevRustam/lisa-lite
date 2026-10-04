import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!)
async function main() {
    const result = await sql`SELECT document_id, COUNT(*) as total, COUNT(embedding) as with_embedding FROM chunks GROUP BY document_id ORDER BY document_id`
    console.log(result)
}
main()