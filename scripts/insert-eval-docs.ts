import postgres from 'postgres'
const sql = postgres(process.env.DATABASE_URL!)

const docs = [
  { filename: 'eval-doc-infra.md', key: 'uploads/eval-doc-infra.md' },
  { filename: 'eval-doc-product.md', key: 'uploads/eval-doc-product.md' },
  { filename: 'eval-doc-security.md', key: 'uploads/eval-doc-security.md' },
  { filename: 'eval-doc-data.md', key: 'uploads/eval-doc-data.md' },
]

async function main() {
  for (const doc of docs) {
    const [row] = await sql`
      INSERT INTO documents (filename, s3_key, status)
      VALUES (${doc.filename}, ${doc.key}, 'uploaded')
      RETURNING id
    `
    console.log(`${doc.filename} -> document id ${row.id}`)
  }
  await sql.end()
}

main()
