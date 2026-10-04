import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!)
async function main() {
    const [doc] = await sql`INSERT INTO documents (filename, s3_key, status) VALUES ('conflict-test.md', 'uploads/manual-conflict-test.md', 'uploaded') RETURNING id`
    console.log('Created document', doc.id)
    await sql.end()
}
main()