import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

async function main() {
    const columns = await sql`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'documents'
  `
    console.log(columns)
}

main()