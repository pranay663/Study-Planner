import { ArrowUpRight, CalendarDays, Clock3 } from 'lucide-react'

const examColors = ['lime', 'blue', 'orange', 'violet', 'mint', 'yellow']

export function UpcomingExams({ subjects }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exams = subjects
    .filter((subject) => subject.examDate)
    .map((subject) => {
      const examDay = new Date(`${subject.examDate}T00:00:00`)
      return { ...subject, examDay, daysAway: Math.ceil((examDay - today) / 86_400_000) }
    })
    .filter((subject) => subject.daysAway >= 0)
    .sort((first, second) => first.examDay - second.examDay)

  return (
    <section className="surface-panel exams-panel" id="exams">
      <div className="panel-heading">
        <div className="heading-icon heading-icon-peach"><CalendarDays size={18} /></div>
        <div><span className="section-kicker">MARK YOUR CALENDAR</span><h2>Upcoming exams</h2></div>
      </div>
      <div className="exam-list">
        {exams.length ? exams.map((exam, index) => (
          <article className="exam-row" key={exam.id}>
            <span className={`exam-color ${examColors[index % examColors.length]}`} />
            <div className="exam-copy"><strong>{exam.name} exam</strong><span>{exam.priority} priority</span></div>
            <div className="exam-date"><strong>{exam.examDay.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}</strong><span><Clock3 size={12} />{exam.daysAway === 0 ? 'Today' : `${exam.daysAway} days`}</span></div>
          </article>
        )) : <p className="no-exams-message">No upcoming exams. Add an exam date to a subject.</p>}
      </div>
      <a className="panel-footer-link" href="#planner">Plan exam prep <ArrowUpRight size={15} /></a>
    </section>
  )
}