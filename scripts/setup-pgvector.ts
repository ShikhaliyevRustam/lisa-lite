import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

async function main() {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`

    await sql`
    ALTER TABLE chunks
    ADD COLUMN IF NOT EXISTS embedding vector(1536)
  `

    console.log('pgvector enabled, embedding column added')
}

main()