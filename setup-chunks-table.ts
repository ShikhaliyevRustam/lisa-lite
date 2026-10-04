import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!)

async function main() {
    await sql`
    CREATE TABLE IF NOT EXISTS chunks (
      id SERIAL PRIMARY KEY,
      document_id INTEGER NOT NULL REFERENCES documents(id),
      breadcrumb TEXT NOT NULL,
      content TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL
    )
  `
    console.log('chunks table created (or already existed)')
}

main()