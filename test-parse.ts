import { remark } from 'remark'
import remarkGfm from 'remark-gfm'

const sample = `# Getting Started

Some intro text here.

## Installation

Run this command.`

const tree = remark().use(remarkGfm).parse(sample)

console.log(JSON.stringify(tree, null, 2))