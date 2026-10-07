import { useState } from 'react'
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'

const pageSize = 5
const markerClasses = { Learning: 'learning', Practice: 'practice', Revision: 'revision', Break: 'break' }

function formatDay(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en', { weekday: 'short' }).toUpperCase()
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function StudyPlanner({ schedule }) {
  const [selectedDate, setSelectedDate] = useState(null)
  const [pageStart, setPageStart] = useState(0)
  const dates = [...new Set(schedule.map((session) => session.date))]
  const safePageStart = Math.min(pageStart, Math.max(0, dates.length - pageSize))
  const visibleDates = dates.slice(safePageStart, safePageStart + pageSize)
  const activeDate = visibleDates.includes(selectedDate) ? selectedDate : visibleDates[0]
  const sessions = schedule.filter((session) => session.date === activeDate)
  const studyMinutes = sessions
    .filter((session) => session.taskType !== 'Break')
    .reduce((total, session) => total + session.durationMinutes, 0)

  function showPage(nextStart) {
    const nextPage = Math.max(0, Math.min(nextStart, dates.length - pageSize))
    setPageStart(nextPage)
    setSelectedDate(dates[nextPage] ?? null)
  }

  return (
    <section className="surface-panel planner-panel" id="planner">
      <div className="planner-heading">
        <div className="panel-heading">
          <div className="heading-icon heading-icon-green"><CalendarDays size={18} /></div>
          <div><span className="section-kicker">AUTO-GENERATED FROM YOUR SUBJECTS</span><h2>Today's Study Plan</h2></div>
        </div>
        <div className="planner-navigation">
          <button className="icon-button planner-nav" aria-label="Previous dates" disabled={safePageStart === 0} onClick={() => showPage(safePageStart - pageSize)}><ChevronLeft size={17} /></button>
          <button className="icon-button planner-nav" aria-label="Next dates" disabled={safePageStart + pageSize >= dates.length} onClick={() => showPage(safePageStart + pageSize)}><ChevronRight size={17} /></button>
        </div>
      </div>

      {visibleDates.length > 0 ? (
        <>
          <div className="week-strip" aria-label="Scheduled study dates">
            {visibleDates.map((date) => (
              <button className={`day-cell${date === activeDate ? ' day-active' : ''}`} key={date} aria-pressed={date === activeDate} onClick={() => setSelectedDate(date)}>
                <span>{formatDay(date)}</span><strong>{new Date(`${date}T00:00:00`).getDate()}</strong>
              </button>
            ))}
          </div>

          <div className="schedule-day-heading"><strong>{formatDate(activeDate)}</strong><span>{(studyMinutes / 60).toLocaleString('en', { maximumFractionDigits: 1 })} study hrs</span></div>
          <div className="session-list generated-session-list">
            {sessions.map((session, index) => (
              <article className={`session-row generated-session-row${session.taskType === 'Break' ? ' break-session-row' : ''}`} key={`${session.date}-${session.startTime}-${session.taskType}-${index}`}>
                <time><strong>{session.startTime}</strong><span>{session.endTime}</span></time>
                <span className={`session-marker ${markerClasses[session.taskType] ?? 'learning'}`} />
                <div className="session-detail"><strong>{session.topic}</strong><span>{session.subject === 'Break' ? 'Reset before your next session' : session.subject}</span></div>
                <span className="session-duration"><Clock3 size={13} />{session.durationMinutes} min</span>
                <span className={`task-type-pill ${markerClasses[session.taskType] ?? 'learning'}`}>{session.taskType}</span>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-plan-state"><CalendarDays size={20} /><strong>No study sessions to schedule</strong><span>Add unfinished topics and upcoming exam dates to generate your plan.</span></div>
      )}
      <a className="panel-footer-link" href="#exams">View upcoming exams <ArrowRight size={15} /></a>
    </section>
  )
}