import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!)
async function main() {
    const result = await sql`SELECT breadcrumb, LENGTH(content) as len FROM chunks WHERE document_id = 7 ORDER BY id LIMIT 10`
    console.log(result)
}
main()