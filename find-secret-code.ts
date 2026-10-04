import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!)
async function main() {
    const result = await sql`SELECT breadcrumb, content FROM chunks WHERE content LIKE '%ALPHA-7749%'`
    console.log(result)
}
main()