import { remark } from 'remark'
import remarkGfm from 'remark-gfm'

interface Chunk {
    breadcrumb: string
    content: string
    startLine: number
    endLine: number
}

const TARGET_CHUNK_SIZE = 800

export function chunkMarkdown(markdown: string): Chunk[] {
    const tree = remark().use(remarkGfm).parse(markdown)
    const lines = markdown.split('\n')

    const headingStack: string[] = []
    const chunks: Chunk[] = []

    let currentBreadcrumb = ''
    let pendingStartLine: number | null = null
    let pendingEndLine: number | null = null
    let pendingSize = 0

    function flush() {
        if (pendingStartLine === null || pendingEndLine === null) return
        const content = lines.slice(pendingStartLine - 1, pendingEndLine).join('\n')
        chunks.push({
            breadcrumb: currentBreadcrumb,
            content,
            startLine: pendingStartLine,
            endLine: pendingEndLine,
        })
        pendingStartLine = null
        pendingEndLine = null
        pendingSize = 0
    }

    for (const node of tree.children as any[]) {
        if (node.type === 'heading') {
            flush()
            const text = node.children.map((child: any) => child.value || '').join('')
            headingStack[node.depth - 1] = text
            headingStack.length = node.depth
            currentBreadcrumb = headingStack.join(' > ')
            continue
        }

        const startLine = node.position.start.line
        const endLine = node.position.end.line
        const nodeContent = lines.slice(startLine - 1, endLine).join('\n')
        const nodeSize = nodeContent.length

        if (pendingSize > 0 && pendingSize + nodeSize > TARGET_CHUNK_SIZE) {
            flush()
        }

        if (pendingStartLine === null) pendingStartLine = startLine
        pendingEndLine = endLine
        pendingSize += nodeSize
    }

    flush()

    return chunks
}