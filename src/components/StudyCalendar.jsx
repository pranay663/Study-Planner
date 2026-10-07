import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, CalendarDays, Check, Clock3, RotateCcw, Sparkles, X } from 'lucide-react'

const viewOptions = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'week', label: 'Next 7 days' },
]

const taskTypeClasses = { Learning: 'learning', Practice: 'practice', Revision: 'revision', Break: 'break' }

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addCalendarDays(date, days) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function formatCalendarDate(dateKey, options = { weekday: 'long', month: 'long', day: 'numeric' }) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('en', options)
}

function timeToMinutes(value) {
  const [time, period] = value.split(' ')
  let [hour, minute] = time.split(':').map(Number)
  if (period === 'PM' && hour !== 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0
  return hour * 60 + minute
}

function durationLabel(minutes) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`
}

export function StudyCalendar({ schedule, subjects, onToggleComplete, onReschedule, onMarkMissed, onRegeneratePlan, missedNotice, unscheduledTopics, validationIssues, availableHoursPerDay, onNavigate }) {
  const [activeView, setActiveView] = useState('today')
  const [reschedulingId, setReschedulingId] = useState(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleError, setRescheduleError] = useState('')
  const [currentTime, setCurrentTime] = useState(() => new Date())

  useEffect(() => {
    const intervalId = setInterval(() => setCurrentTime(new Date()), 30_000)
    return () => clearInterval(intervalId)
  }, [])

  const today = new Date(currentTime)
  today.setHours(0, 0, 0, 0)
  const todayKey = toDateKey(today)
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
  const tomorrowKey = toDateKey(addCalendarDays(today, 1))
  const dates = activeView === 'today'
    ? [todayKey]
    : activeView === 'tomorrow'
      ? [tomorrowKey]
      : Array.from({ length: 7 }, (_, index) => toDateKey(addCalendarDays(today, index)))
  const calendarDays = dates.map((date) => ({
    date,
    events: schedule
      .filter((task) => task.date === date)
      .sort((first, second) => timeToMinutes(first.startTime) - timeToMinutes(second.startTime)),
  }))

  function beginReschedule(task) {
    setReschedulingId(task.id)
    setRescheduleDate(toDateKey(addCalendarDays(today, 1)))
    setRescheduleError('')
  }

  function saveReschedule(task) {
    const success = onReschedule(task.id, rescheduleDate)
    if (success) {
      setReschedulingId(null)
      setRescheduleError('')
    } else {
      setRescheduleError('That day has no room for this session, or it falls after the exam.')
    }
  }

  function maxRescheduleDate(task) {
    const nextWeekEnd = addCalendarDays(today, 6)
    const subject = subjects.find((item) => item.id === task.subjectId)
    if (!subject?.examDate) return toDateKey(nextWeekEnd)
    const examEve = addCalendarDays(new Date(`${subject.examDate}T00:00:00`), -1)
    return toDateKey(examEve < nextWeekEnd ? examEve : nextWeekEnd)
  }

  function canMarkMissed(task) {
    return task.date < todayKey || (task.date === todayKey && timeToMinutes(task.endTime) <= currentMinutes)
  }

  const visibleEvents = calendarDays.flatMap((day) => day.events)
  const studyEvents = visibleEvents.filter((task) => task.taskType !== 'Break')
  const completedCount = studyEvents.filter((task) => task.completed).length
  const totalMinutes = studyEvents.reduce((total, task) => total + task.durationMinutes, 0)

  return (
    <section className="study-calendar-page" id="calendar">
      <div className="calendar-page-topline">
        <div className="breadcrumb">YOUR STUDY SPACE <span>/</span> CALENDAR</div>
        <div className="calendar-top-actions">
          <button className="calendar-regenerate-button" type="button" onClick={onRegeneratePlan}><RotateCcw size={14} /> Regenerate plan</button>
          <button className="calendar-back-link" type="button" onClick={() => onNavigate('dashboard')}><ArrowLeft size={15} /> Back to dashboard</button>
        </div>
      </div>

      <header className="calendar-page-heading">
        <div className="calendar-heading-icon"><CalendarDays size={22} /></div>
        <div><span className="section-kicker">YOUR PLAN, AT A GLANCE</span><h1>Study Calendar</h1><p>A balanced schedule built around your subjects and exam dates.</p></div>
      </header>

      <div className="calendar-toolbar">
        <div className="calendar-view-tabs" role="tablist" aria-label="Calendar range">
          {viewOptions.map((option) => <button type="button" role="tab" aria-selected={activeView === option.id} className={activeView === option.id ? 'calendar-view-tab is-selected' : 'calendar-view-tab'} onClick={() => { setActiveView(option.id); setReschedulingId(null); setRescheduleError('') }} key={option.id}>{option.label}</button>)}
        </div>
        <div className="calendar-summary"><span><Clock3 size={14} />{durationLabel(totalMinutes)} scheduled</span><span><Check size={14} />{completedCount}/{studyEvents.length} complete</span></div>
      </div>

      {missedNotice && <div className="adaptive-recovery-notice" role="status"><div className="recovery-icon"><Sparkles size={16} /></div><span>{missedNotice}</span></div>}
      {validationIssues.length > 0 && <div className="adaptive-input-warning" role="alert"><div><AlertTriangle size={17} /><strong>Check your planner details</strong></div><ul>{validationIssues.slice(0, 6).map((issue, index) => <li key={`${issue.code}-${issue.subjectId ?? index}`}>{issue.message}</li>)}</ul></div>}
      {unscheduledTopics.length > 0 && <div className="adaptive-capacity-warning" role="alert"><div><AlertTriangle size={17} /><strong>Some work won't fit before its exam</strong></div><p>The plan stays within {availableHoursPerDay} available study hours per day and keeps revision time before exams. These topics need more time than remains:</p><ul>{unscheduledTopics.slice(0, 5).map((topic) => <li key={`${topic.subjectId}-${topic.topicId}`}><strong>{topic.subject}:</strong> {topic.topic} <span>{topic.remainingMinutes} min · {topic.remainingDays === null ? 'no exam date' : `${topic.remainingDays} days left`}</span></li>)}</ul></div>}

      <div className={`calendar-day-list${activeView === 'week' ? ' calendar-week-list' : ''}`}>
        {calendarDays.map(({ date, events }) => {
          const dayStudyEvents = events.filter((task) => task.taskType !== 'Break')
          const dayCompleted = dayStudyEvents.filter((task) => task.completed).length
          const dayMinutes = dayStudyEvents.reduce((total, task) => total + task.durationMinutes, 0)
          return (
            <section className="calendar-day-section" key={date}>
              <div className="calendar-day-heading">
                <div><span className="calendar-day-weekday">{formatCalendarDate(date, { weekday: 'long' })}</span><h2>{formatCalendarDate(date, { month: 'long', day: 'numeric', year: 'numeric' })}</h2></div>
                <div className="calendar-day-totals"><strong>{durationLabel(dayMinutes)}</strong><span>{dayCompleted}/{dayStudyEvents.length} complete</span></div>
              </div>
              {events.length ? (
                <div className="calendar-event-list">
                  {events.map((task) => task.taskType === 'Break' ? (
                    <article className="calendar-break-row" key={task.id}>
                      <time>{task.startTime}<span>{task.endTime}</span></time>
                      <span className="calendar-event-marker break" />
                      <div className="calendar-event-copy"><strong>Short break</strong><span>Step away and reset</span></div>
                      <span className="calendar-event-duration">{durationLabel(task.durationMinutes)}</span>
                      <span className="calendar-task-type break">Break</span>
                    </article>
                  ) : (
                    <article className={`calendar-event-row${task.completed ? ' calendar-event-completed' : ''}`} key={task.id}>
                      <label className="calendar-completion-control" aria-label={`Mark ${task.topic} ${task.completed ? 'incomplete' : 'complete'}`}>
                        <input type="checkbox" checked={task.completed} onChange={() => onToggleComplete(task)} />
                        <span>{task.completed && <Check size={13} />}</span>
                      </label>
                      <time>{task.startTime}<span>{task.endTime}</span></time>
                      <span className={`calendar-event-marker ${taskTypeClasses[task.taskType]}`} />
                      <div className="calendar-event-copy"><strong>{task.topic}</strong><span>{task.subject}</span></div>
                      <span className="calendar-event-duration">{durationLabel(task.durationMinutes)}</span>
                      <span className={`calendar-task-type ${taskTypeClasses[task.taskType]}`}>{task.taskType}</span>
                      {!task.completed && <div className="calendar-task-actions">
                        {canMarkMissed(task) && <button className="calendar-missed-button" type="button" onClick={() => onMarkMissed(task)} aria-label={`Mark ${task.topic} as missed`}>Missed</button>}
                        <button className="calendar-reschedule-button" type="button" onClick={() => beginReschedule(task)} aria-label={`Reschedule ${task.topic}`}><RotateCcw size={14} /><span>Reschedule</span></button>
                      </div>}
                      {reschedulingId === task.id && <div className="calendar-reschedule-form">
                        <label><span>Move to</span><input type="date" min={todayKey} max={maxRescheduleDate(task)} value={rescheduleDate} onChange={(event) => { setRescheduleDate(event.target.value); setRescheduleError('') }} /></label>
                        <button className="primary-button" type="button" onClick={() => saveReschedule(task)}>Save</button>
                        <button className="icon-button" type="button" onClick={() => { setReschedulingId(null); setRescheduleError('') }} aria-label="Cancel rescheduling"><X size={15} /></button>
                        {rescheduleError && <span className="reschedule-error" role="alert">{rescheduleError}</span>}
                      </div>}
                    </article>
                  ))}
                </div>
              ) : <div className="calendar-empty-day">Nothing scheduled. Enjoy the breathing room.</div>}
            </section>
          )
        })}
      </div>
      <div className="calendar-legend" aria-label="Study task types">
        {['Learning', 'Practice', 'Revision'].map((type) => <span key={type}><i className={taskTypeClasses[type]} />{type}</span>)}
        <span><i className="completed-legend"><Check size={10} /></i>Completed</span>
        <span><i className="break-legend" />Break</span>
      </div>
    </section>
  )
}