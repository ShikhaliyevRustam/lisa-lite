import postgres from 'postgres'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import OpenAI from 'openai'
import { chunkMarkdown } from './chunker.ts'

const sql = postgres(process.env.DATABASE_URL!)
const s3 = new S3Client({ region: 'eu-central-1' })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function ingestDocument(documentId: number) {
  try {
    const [doc] = await sql`SELECT s3_key FROM documents WHERE id = ${documentId}`
    if (!doc) throw new Error(`No document with id ${documentId}`)

    const command = new GetObjectCommand({ Bucket: 'lisa-lite-207871832731', Key: doc.s3_key })
    const response = await s3.send(command)
    const markdown = await response.Body!.transformToString()

    const chunks = chunkMarkdown(markdown)
    const expectedCount = chunks.length
    let successCount = 0

    for (const chunk of chunks) {
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk.content,
        })
        const embedding = embeddingResponse.data[0].embedding

        await sql`
          INSERT INTO chunks (document_id, breadcrumb, content, start_line, end_line, embedding)
          VALUES (${documentId}, ${chunk.breadcrumb}, ${chunk.content}, ${chunk.startLine}, ${chunk.endLine}, ${JSON.stringify(embedding)})
        `
        successCount++
      } catch (err) {
        console.error(`  Failed chunk at line ${chunk.startLine}:`, err)
      }
    }

    if (successCount === expectedCount) {
      await sql`UPDATE documents SET status = 'ready' WHERE id = ${documentId}`
      console.log(`Document ${documentId}: ready (${successCount}/${expectedCount} chunks)`)
    } else {
      await sql`UPDATE documents SET status = 'failed' WHERE id = ${documentId}`
      console.error(`Document ${documentId}: FAILED (${successCount}/${expectedCount} chunks)`)
    }
  } catch (err) {
    console.error(`Document ${documentId}: FATAL ERROR`, err)
    await sql`UPDATE documents SET status = 'failed' WHERE id = ${documentId}`
  }
}

async function main() {
  const ids = process.argv.slice(2).map(Number)
  const start = Date.now()
  for (const id of ids) {
    const docStart = Date.now()
    await ingestDocument(id)
    console.log(`  (took ${((Date.now() - docStart) / 1000).toFixed(1)}s)`)
  }
  console.log(`Total: ${((Date.now() - start) / 1000).toFixed(1)}s`)
  await sql.end()
}

main()
