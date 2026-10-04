const chunks = [{ id: 1 }, { id: 2 }, { id: 3 }] // pretend we only retrieved 3 chunks
const fakeAnswerText = 'This is supported by [1] and also by [7], which does not exist.'

const citedNumbers = [...fakeAnswerText.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]))
for (const num of citedNumbers) {
    const chunk = chunks[num - 1]
    console.log(`[${num}]:`, chunk ? 'valid' : 'INVALID - would be flagged')
}