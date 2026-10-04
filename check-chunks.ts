import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

async function main() {
    const chunks = await sql`SELECT * FROM chunks`
    console.log(chunks)

    const docs = await sql`SELECT id, filename, status FROM documents`
    console.log(docs)
}

main()