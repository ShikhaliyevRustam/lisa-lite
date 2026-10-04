import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

async function main() {
    const docs = await sql`SELECT * FROM documents`
    console.log(docs)
}

main()