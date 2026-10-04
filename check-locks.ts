import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!)
async function main() {
    const result = await sql`SELECT pid, state, query, now() - query_start AS duration FROM pg_stat_activity WHERE state != 'idle'`
    console.log(result)
}
main()