import { remark } from 'remark'
import remarkGfm from 'remark-gfm'

const sample = `# Getting Started

Some intro text here.

## Installation

Run this command.

# Reference

API details here.

## Configuration

Config details here.`

const tree = remark().use(remarkGfm).parse(sample)

const headingStack: string[] = []

for (const node of tree.children) {
    if (node.type === 'heading') {
        const text = node.children.map((child: any) => child.value || '').join('')
        headingStack[node.depth - 1] = text
        headingStack.length = node.depth
    } else {
        const breadcrumb = headingStack.join(' > ')
        console.log(`[${breadcrumb}] (line ${node.position.start.line}):`, node.type)
    }
}