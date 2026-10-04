import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!)
async function main() {
    await sql`DELETE FROM chunks WHERE document_id = 4`
    console.log('Deleted old chunks for document 4')
}
main()