import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import postgres from 'postgres'
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
import { answerQuestion } from '../generate.ts'

const sqs = new SQSClient({ region: 'eu-central-1' })
const QUEUE_URL = 'https://sqs.eu-central-1.amazonaws.com/207871832731/lisa-lite-ingestion-queue'

const s3 = new S3Client({ region: 'eu-central-1' })
const sql = postgres(process.env.DATABASE_URL!)

const askQuestion = createServerFn()
    .validator((question: string) => question)
    .handler(async ({ data: question }) => {
        return await answerQuestion(question)
    })

const getUploadUrl = createServerFn()
    .validator((filename: string) => {
        if (!/\.md$/i.test(filename)) throw new Error('Only .md files are accepted')
        return filename
    })
    .handler(async ({ data: filename }) => {
        const safeName = filename.replace(/[^\w.\-]+/g, '_')
        const key = `uploads/${Date.now()}-${safeName}`

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

interface Citation {
    number: number
    valid: boolean
    filename?: string
    documentId?: number
    breadcrumb?: string
    startLine?: number
    endLine?: number
    quoteSupported?: boolean
}

interface SourceChunk {
    document_id: number
    start_line: number
    end_line: number
    content: string
}

interface ChatEntry {
    question: string
    answer: string
    confidence: string
    citations: Citation[]
    sources: SourceChunk[]
}

function Home() {
    const [status, setStatus] = useState('')
    const [documents, setDocuments] = useState<Array<{ id: number; filename: string; status: string; created_at: string }>>([])
    const [chatInput, setChatInput] = useState('')
    const [chatHistory, setChatHistory] = useState<ChatEntry[]>([])
    const [asking, setAsking] = useState(false)
    const [askError, setAskError] = useState('')

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

        if (!file.name.toLowerCase().endsWith('.md')) {
            setStatus('Only .md files are accepted.')
            return
        }

        try {
            setStatus('Requesting upload URL...')
            const { uploadUrl } = await getUploadUrl({ data: file.name })

            setStatus('Uploading...')
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': 'text/markdown' },
            })

            if (!uploadResponse.ok) {
                setStatus(`Upload failed (${uploadResponse.status}). Please try again.`)
                return
            }

            setStatus('Upload complete. Processing continues in the background; reload to see the status.')
            await loadDocuments()
        } catch (err) {
            setStatus('Upload failed. Please try again.')
        }
    }

    async function handleAsk() {
        const question = chatInput.trim()
        if (!question) return
        setAsking(true)
        setAskError('')
        try {
            const result = await askQuestion({ data: question })
            setChatHistory((prev) => [
                ...prev,
                {
                    question,
                    answer: result.answer,
                    confidence: result.confidence,
                    citations: result.verifiedCitations,
                    sources: result.sources,
                },
            ])
            setChatInput('')
        } catch (err) {
            setAskError('Something went wrong while answering. Please try again.')
        } finally {
            setAsking(false)
        }
    }

    useEffect(() => {
        loadDocuments()
    }, [])

    return (
        <div className="p-8">
            <h1 className="text-4xl font-bold">LISA Lite</h1>
            <input
                type="file"
                accept=".md"
                onChange={handleFileChange}
                className="file:mr-3 file:cursor-pointer file:rounded file:border file:px-4 file:py-1 hover:file:bg-gray-100"
            />
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
                {askError && <p className="mt-2 text-red-600">{askError}</p>}

                {chatHistory.map((entry, i) => (
                    <div key={i} className="mt-4 border-t pt-4">
                        <p><strong>Q:</strong> {entry.question}</p>
                        <p className="whitespace-pre-wrap"><strong>A:</strong> {entry.answer}</p>
                        <p
                            className="mt-2 text-sm"
                            title="A heuristic from citation checks and retrieval agreement. It is not a probability that the answer is correct."
                        >
                            <strong>Support:</strong> {entry.confidence}
                        </p>
                        <div className="mt-1">
                            {entry.citations.map((c, j) => {
                                const passage = entry.sources.find(
                                    (s) =>
                                        s.document_id === c.documentId &&
                                        s.start_line === c.startLine &&
                                        s.end_line === c.endLine
                                )
                                return (
                                    <details key={j} className="text-sm text-gray-600">
                                        <summary className="cursor-pointer">
                                            [{c.number}]{' '}
                                            {c.valid
                                                ? `${c.filename} (doc ${c.documentId}) › ${c.breadcrumb || 'no heading'} · lines ${c.startLine}-${c.endLine}`
                                                : 'Invalid citation (not among the retrieved passages)'}
                                            {c.valid && c.quoteSupported === false && (
                                                <span title="A word-overlap check could not confirm this passage supports the sentence citing it.">
                                                    {' '}⚠️ unverified
                                                </span>
                                            )}
                                        </summary>
                                        {passage && (
                                            <pre className="mt-1 whitespace-pre-wrap border-l-2 pl-3">{passage.content}</pre>
                                        )}
                                    </details>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}