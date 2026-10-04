import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!)
async function main() {
    await sql`DELETE FROM chunks WHERE document_id = 7`
    console.log('Cleared chunks for document 7')
}
main()