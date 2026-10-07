import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const maximumBodyBytes = 48 * 1024
const maximumQuestionLength = 1500
const maximumContextLength = 16_000

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(payload))
}

async function readJsonBody(request) {
  const chunks = []
  let bodySize = 0

  for await (const chunk of request) {
    bodySize += chunk.length
    if (bodySize > maximumBodyBytes) throw new HttpError(413, 'Request is too large.')
    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.')
  }
}

function normalizeConversation(value) {
  if (!Array.isArray(value)) return []
  return value.slice(-8).flatMap((message) => {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') return []
    const content = message.content.trim().slice(0, 1500)
    return content ? [{ role: message.role, content }] : []
  })
}

export function createAssistantServer({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_MODEL || 'gpt-4o-mini',
  fetchImpl = fetch,
} = {}) {
  return createServer(async (request, response) => {
    if (request.url !== '/api/assistant') {
      sendJson(response, 404, { error: 'API endpoint not found.' })
      return
    }
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Use POST to ask the study assistant.' })
      return
    }
    if (!apiKey) {
      sendJson(response, 503, { error: 'The study assistant is not configured yet. Add OPENAI_API_KEY to the server environment.' })
      return
    }

    try {
      const body = await readJsonBody(request)
      const question = typeof body.question === 'string' ? body.question.trim() : ''
      if (!question || question.length > maximumQuestionLength) {
        throw new HttpError(400, `Enter a question between 1 and ${maximumQuestionLength} characters.`)
      }

      const context = JSON.stringify(body.context ?? {})
      if (context.length > maximumContextLength) throw new HttpError(413, 'Planner context is too large. Try again with fewer subjects or topics.')

      const conversation = normalizeConversation(body.conversation)
      const messages = [
        {
          role: 'system',
          content: 'You are Studywise, a concise and supportive study-planning assistant. Use the supplied planner data as the source of truth. Recommend unfinished topics, prioritize exams that are closer, consider difficulty, subject priority, estimates, and available study hours. Explain recommendations briefly. For missed sessions, redistribute work across remaining available days without exceeding daily hours. Suggest revision before exams and adapt when study time changes. Do not claim to change the schedule or persist anything. If planner information is missing, say what is missing instead of inventing it. Keep answers practical and concise.',
        },
        {
          role: 'user',
          content: `Current planner context:\n${context}`,
        },
        ...conversation,
        { role: 'user', content: question },
      ]

      const upstreamResponse = await fetchImpl('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: 500 }),
        signal: AbortSignal.timeout(30_000),
      })

      if (!upstreamResponse.ok) {
        if (upstreamResponse.status === 429) {
          sendJson(response, 429, { error: 'The assistant is busy right now. Please wait a moment and try again.' })
          return
        }
        sendJson(response, 502, { error: 'The assistant could not respond right now. Please try again shortly.' })
        return
      }

      const result = await upstreamResponse.json()
      const answer = result.choices?.[0]?.message?.content?.trim()
      if (!answer) {
        sendJson(response, 502, { error: 'The assistant returned an empty reply. Please try asking another way.' })
        return
      }

      sendJson(response, 200, { answer })
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(response, error.statusCode, { error: error.message })
        return
      }
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        sendJson(response, 504, { error: 'The assistant took too long to respond. Please try again.' })
        return
      }
      sendJson(response, 502, { error: 'Unable to reach the assistant service. Check your connection and try again.' })
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.API_PORT || 3001)
  createAssistantServer().listen(port, '127.0.0.1', () => {
    console.log(`Study assistant API listening on http://127.0.0.1:${port}`)
  })
}