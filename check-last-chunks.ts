import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!)
async function main() {
    const result = await sql`SELECT breadcrumb, start_line, end_line FROM chunks WHERE document_id = 7 ORDER BY id DESC LIMIT 5`
    console.log(result)
}
main()