import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!)
async function main() {
    await sql`DELETE FROM chunks WHERE document_id = 7`
    await sql`UPDATE documents SET status = 'uploaded' WHERE id = 7`
    console.log('Reset document 7')
    await sql.end()
}
main()