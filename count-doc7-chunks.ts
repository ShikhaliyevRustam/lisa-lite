import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!)
async function main() {
    const result = await sql`SELECT COUNT(*) FROM chunks WHERE document_id = 7`
    console.log(result)
}
main()