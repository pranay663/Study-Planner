import assert from 'node:assert/strict'
import test from 'node:test'
import { createAssistantServer } from './index.js'

async function withServer(options, action) {
  const server = createAssistantServer(options)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  try {
    return await action(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

test('returns a clear configuration error when the server API key is missing', async () => {
  await withServer({ apiKey: '' }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/assistant`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'What should I study next?' }),
    })

    assert.equal(response.status, 503)
    assert.match((await response.json()).error, /OPENAI_API_KEY/)
  })
})

test('validates that the request contains a usable question', async () => {
  await withServer({ apiKey: 'test-key' }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/assistant`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: '   ' }),
    })

    assert.equal(response.status, 400)
    assert.match((await response.json()).error, /Enter a question/)
  })
})

test('sends planner context to the provider and returns only its answer', async () => {
  let providerRequest
  const fakeFetch = async (url, options) => {
    providerRequest = { url, options }
    return new Response(JSON.stringify({ choices: [{ message: { content: 'Study Genetics next because its exam is closest.' } }] }), { status: 200 })
  }

  await withServer({ apiKey: 'server-test-key', fetchImpl: fakeFetch }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/assistant`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        question: 'What should I study next?',
        context: { subjects: [{ name: 'Biology', unfinishedTopics: ['Genetics'] }], upcomingExams: [] },
        conversation: [{ role: 'assistant', content: 'I can help with your study plan.' }],
      }),
    })
    const result = await response.json()
    const sentBody = JSON.parse(providerRequest.options.body)

    assert.equal(response.status, 200)
    assert.equal(result.answer, 'Study Genetics next because its exam is closest.')
    assert.equal(providerRequest.url, 'https://api.openai.com/v1/chat/completions')
    assert.equal(providerRequest.options.headers.authorization, 'Bearer server-test-key')
    assert.match(sentBody.messages[1].content, /Genetics/)
    assert.equal(sentBody.messages[2].role, 'assistant')
    assert.equal(JSON.stringify(result).includes('server-test-key'), false)
  })
})

test('returns a retryable message when the provider rate-limits requests', async () => {
  await withServer({
    apiKey: 'server-test-key',
    fetchImpl: async () => new Response('{}', { status: 429 }),
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/assistant`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'How do I revise?' }),
    })

    assert.equal(response.status, 429)
    assert.match((await response.json()).error, /try again/)
  })
})