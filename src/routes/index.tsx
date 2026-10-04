import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import postgres from 'postgres'
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { answerQuestion } from '../generate.ts'

const askQuestion = createServerFn()
    .validator((question: string) => question)
    .handler(async ({ data: question }) => {
        return await answerQuestion(question)
    })

const sqs = new SQSClient({ region: 'eu-central-1' })
const QUEUE_URL = 'https://sqs.eu-central-1.amazonaws.com/207871832731/lisa-lite-ingestion-queue'

const s3 = new S3Client({ region: 'eu-central-1' })
const sql = postgres(process.env.DATABASE_URL!)

const getUploadUrl = createServerFn()
    .validator((filename: string) => filename)
    .handler(async ({ data: filename }) => {
        const key = `uploads/${Date.now()}-${filename}`

        const command = new PutObjectCommand({
            Bucket: 'lisa-lite-207871832731',
            Key: key,
            ContentType: 'text/markdown',
        })

        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 })

        const [doc] = await sql`
            INSERT INTO documents (filename, s3_key, status)
            VALUES (${filename}, ${key}, 'uploaded')
                RETURNING id
        `

        await sqs.send(new SendMessageCommand({
            QueueUrl: QUEUE_URL,
            MessageBody: JSON.stringify({ documentId: doc.id }),
        }))

        return { uploadUrl, key, documentId: doc.id }
    })

const getDocuments = createServerFn().handler(async () => {
    const docs = await sql`SELECT id, filename, status, created_at FROM documents ORDER BY created_at DESC`
    return docs
})
export const Route = createFileRoute('/')({ component: Home })

function Home() {
    const [status, setStatus] = useState('')
    const [documents, setDocuments] = useState<Array<{ id: number; filename: string; status: string; created_at: string }>>([])
    const [chatInput, setChatInput] = useState('')
    const [chatHistory, setChatHistory] = useState<Array<{ question: string; answer: string; citations: any[] }>>([])
    const [asking, setAsking] = useState(false)

    async function loadDocuments() {
        const docs = await getDocuments()
        setDocuments(docs.map((doc) => ({
            id: doc.id,
            filename: doc.filename,
            status: doc.status,
            created_at: doc.created_at,
        })))
    }

    async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        if (!file) return

        setStatus('Requesting upload URL...')
        const { uploadUrl } = await getUploadUrl({ data: file.name })

        setStatus('Uploading...')
        await fetch(uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': 'text/markdown' },
        })

        setStatus('Upload complete!')
        await loadDocuments()
    }

    async function handleAsk() {
        if (!chatInput.trim()) return
        setAsking(true)
        const result = await askQuestion({ data: chatInput })
        setChatHistory((prev) => [...prev, { question: chatInput, answer: result.answer, citations: result.verifiedCitations }])
        setChatInput('')
        setAsking(false)
    }

    useEffect(() => {
        loadDocuments()
    }, [])

    return (
        <div className="p-8">
            <h1 className="text-4xl font-bold">LISA Lite</h1>
            <input type="file" accept=".md" onChange={handleFileChange} />
            <p>{status}</p>
            <ul>
                {documents.map((doc) => (
                    <li key={doc.id}>
                        {doc.filename} — {doc.status}
                    </li>
                ))}
            </ul>

            <div className="mt-8">
                <h2 className="text-2xl font-bold">Ask a question</h2>
                <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask something about your documents..."
                    className="border px-2 py-1 mr-2 w-96"
                />
                <button onClick={handleAsk} disabled={asking} className="border px-4 py-1">
                    {asking ? 'Thinking...' : 'Ask'}
                </button>

                {chatHistory.map((entry, i) => (
                    <div key={i} className="mt-4 border-t pt-4">
                        <p><strong>Q:</strong> {entry.question}</p>
                        <p><strong>A:</strong> {entry.answer}</p>
                        <div>
                            {entry.citations.map((c, j) => (
                                <div key={j} className="text-sm text-gray-500">
                                    [{c.number}] {c.valid ? `${c.breadcrumb} (lines ${c.startLine}-${c.endLine})` : 'Invalid citation'}
                                    {c.quoteSupported === false && ' ⚠️ unverified'}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}