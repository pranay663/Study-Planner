import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, BookOpen, Bot, CalendarDays, Check, Clock3, Send, Sparkles, UserRound } from 'lucide-react'

const suggestions = [
  'What should I study next, and why?',
  'I missed a study session. Help me catch up.',
  'What should I revise before my closest exam?',
  'Give me a concise strategy for today.',
]

function makeMessageId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function formatExamDate(date) {
  if (!date) return 'No exam date'
  return new Date(`${date}T00:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function AIStudyAssistant({ context, availableHoursPerDay, onAvailableHoursChange }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hi Jamie. I can help you make sense of your subjects, exams, and study plan. Your current planner data is attached to every question, so let's make your next study block count.",
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [hoursDraft, setHoursDraft] = useState(String(availableHoursPerDay))
  const [hoursError, setHoursError] = useState('')
  const endOfMessagesRef = useRef(null)

  useEffect(() => {
    setHoursDraft(String(availableHoursPerDay))
  }, [availableHoursPerDay])

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isLoading])

  async function sendMessage(question) {
    const cleanedQuestion = question.trim()
    if (!cleanedQuestion || isLoading) return

    const conversation = messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .slice(-8)
      .map(({ role, content }) => ({ role, content }))
    setMessages((current) => [...current, { id: makeMessageId(), role: 'user', content: cleanedQuestion }])
    setInput('')
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: cleanedQuestion, context, conversation }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'The assistant could not respond. Please try again.')
      if (typeof result.answer !== 'string' || !result.answer.trim()) throw new Error('The assistant returned an empty reply. Please try again.')
      setMessages((current) => [...current, { id: makeMessageId(), role: 'assistant', content: result.answer.trim() }])
    } catch (requestError) {
      setError(requestError.message || 'Could not connect to the study assistant. Check the server and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    sendMessage(input)
  }

  function handleHoursSubmit(event) {
    event.preventDefault()
    const nextHours = Number(hoursDraft)
    if (!Number.isFinite(nextHours) || nextHours < 0.5 || nextHours > 12) {
      setHoursError('Choose between 0.5 and 12 hours per day.')
      return
    }
    setHoursError('')
    onAvailableHoursChange(nextHours)
    setInput(`I now have ${nextHours} study hours per day. How should I adjust my plan?`)
  }

  const nextExam = context.upcomingExams[0]
  const unfinishedTopics = context.subjects.reduce((total, subject) => total + subject.topics.filter((topic) => !topic.completed).length, 0)

  return (
    <section className="assistant-page" id="assistant">
      <div className="assistant-topline">
        <div className="breadcrumb">YOUR STUDY SPACE <span>/</span> AI ASSISTANT</div>
        <span className="assistant-data-status"><span /> PLANNER DATA CONNECTED</span>
      </div>

      <header className="assistant-page-heading">
        <div className="assistant-heading-mark"><Sparkles size={22} /></div>
        <div><span className="section-kicker">A LITTLE CLARITY GOES A LONG WAY</span><h1>Study assistant</h1><p>Get practical advice grounded in your subjects, exam dates, and study plan.</p></div>
      </header>

      <div className="assistant-workspace">
        <section className="assistant-chat-panel" aria-label="Study assistant chat">
          <div className="assistant-chat-header">
            <div className="assistant-avatar"><Bot size={19} /></div>
            <div className="assistant-chat-title"><strong>Studywise assistant</strong><span><i /> Ready to help with your plan</span></div>
            <span className="assistant-model-badge">PLANNER-AWARE</span>
          </div>

          <div className="assistant-transcript" aria-live="polite" aria-label="Conversation">
            {messages.map((message) => (
              <article className={`chat-message ${message.role}`} key={message.id}>
                <div className="message-avatar">{message.role === 'assistant' ? <Sparkles size={15} /> : <UserRound size={15} />}</div>
                <div className="message-body"><span className="message-author">{message.role === 'assistant' ? 'Studywise' : 'You'}</span><p>{message.content}</p></div>
              </article>
            ))}
            {isLoading && <div className="assistant-loading" role="status"><span className="typing-indicator"><i /><i /><i /></span><span>Reviewing your study plan…</span></div>}
            <div ref={endOfMessagesRef} />
          </div>

          {messages.length === 1 && !isLoading && <div className="assistant-suggestions" aria-label="Suggested questions">
            <span>TRY ASKING</span>
            <div>{suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => sendMessage(suggestion)}><Sparkles size={13} />{suggestion}</button>)}</div>
          </div>}

          {error && <div className="assistant-error" role="alert"><strong>Couldn't get a reply</strong><span>{error}</span><button type="button" onClick={() => setError('')}>Dismiss</button></div>}

          <form className="assistant-composer" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="assistant-question">Ask about your study plan</label>
            <textarea id="assistant-question" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); handleSubmit(event) } }} placeholder="Ask about your next topic, exam prep, or a missed session…" maxLength={1500} rows={2} disabled={isLoading} />
            <div className="composer-footer"><span>Planner context is included automatically</span><button className="assistant-send-button" type="submit" disabled={!input.trim() || isLoading} aria-label="Send message">{isLoading ? <span className="send-spinner" /> : <Send size={16} />}<span>{isLoading ? 'Thinking' : 'Send'}</span></button></div>
          </form>
        </section>

        <aside className="assistant-context-panel" aria-label="Current planner context">
          <div className="context-panel-heading"><div><span className="section-kicker">YOUR PLAN, RIGHT NOW</span><h2>Study context</h2></div><span className="context-live-dot" title="Using current planner data" /></div>
          <div className="context-summary-grid">
            <div><BookOpen size={15} /><span>Subjects</span><strong>{context.subjects.length}</strong></div>
            <div><Check size={15} /><span>Topics left</span><strong>{unfinishedTopics}</strong></div>
          </div>
          <form className="assistant-hours-form" onSubmit={handleHoursSubmit}>
            <label htmlFor="assistant-daily-hours"><span><Clock3 size={15} /> Available each day</span><span className="hours-control"><input id="assistant-daily-hours" type="number" min="0.5" max="12" step="0.5" value={hoursDraft} onChange={(event) => { setHoursDraft(event.target.value); setHoursError('') }} /><span>hrs</span></span></label>
            <button type="submit">Update time & ask for advice</button>
            {hoursError && <span className="hours-error" role="alert">{hoursError}</span>}
          </form>
          <div className="context-exam-heading"><span><CalendarDays size={14} /> UPCOMING EXAMS</span><span>{context.upcomingExams.length}</span></div>
          <div className="context-exam-list">
            {context.upcomingExams.slice(0, 4).map((exam) => <div className="context-exam-row" key={`${exam.name}-${exam.examDate}`}><span><strong>{exam.name}</strong><small>{exam.priority} priority</small></span><time>{formatExamDate(exam.examDate)}</time></div>)}
            {!context.upcomingExams.length && <p>No upcoming exam dates yet.</p>}
          </div>
          <div className="context-footnote"><Check size={13} /> Answers use your current subjects, unfinished topics, exam dates, and schedule.</div>
          {nextExam && <div className="next-exam-note"><CalendarDays size={14} /><span>Next up: <strong>{nextExam.name}</strong> on {formatExamDate(nextExam.examDate)}</span></div>}
        </aside>
      </div>
    </section>
  )
}