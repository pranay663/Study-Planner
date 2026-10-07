import { ArrowUpRight, ChartNoAxesColumnIncreasing, Target } from 'lucide-react'

const progressColors = ['lime', 'blue', 'orange', 'violet', 'mint', 'yellow']

function hoursLabel(minutes) {
  const hours = minutes / 60
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hrs`
}

export function Progress({ subjects, progress }) {
  const chartMaximum = Math.max(60, ...progress.weeklyActivity.map((day) => day.plannedMinutes))

  return (
    <section className="surface-panel progress-panel" id="progress">
      <div className="panel-heading">
        <div className="heading-icon heading-icon-lavender"><ChartNoAxesColumnIncreasing size={18} /></div>
        <div><span className="section-kicker">YOUR STUDY ACTIVITY</span><h2>Progress overview</h2></div>
      </div>

      <div className="progress-overview">
        <div className="progress-ring" style={{ '--progress': `${progress.overallPercentage}%` }}><div><strong>{progress.overallPercentage}<small>%</small></strong><span>topics done</span></div></div>
        <div className="progress-summary"><strong>{progress.completedTopics} of {progress.totalTopics} topics complete</strong><span>{progress.remainingTopics} topics left across your subjects.</span><div className="progress-mini"><Target size={14} />{progress.todayCompletionRate}% of today's tasks done</div></div>
      </div>

      <div className="progress-metric-grid">
        <div className="progress-metric"><span>COMPLETED TOPICS</span><strong>{progress.completedTopics}</strong></div>
        <div className="progress-metric"><span>REMAINING TOPICS</span><strong>{progress.remainingTopics}</strong></div>
        <div className="progress-metric"><span>COMPLETED HOURS</span><strong>{hoursLabel(progress.completedStudyMinutes)}</strong></div>
        <div className="progress-metric"><span>PLANNED HOURS</span><strong>{hoursLabel(progress.plannedStudyMinutes)}</strong></div>
      </div>

      <div className="today-progress-block">
        <div className="today-progress-title"><span>Today's completion</span><strong>{progress.todayCompletionRate}%</strong></div>
        <div className="task-progress-track"><span style={{ width: `${progress.todayCompletionRate}%` }} /></div>
        <small>{progress.todayCompletedTasks} of {progress.todayTotalTasks} study tasks completed</small>
      </div>

      <div className="subject-progress-heading"><span>BY SUBJECT</span><span>{subjects.length} subjects</span></div>
      <div className="progress-subject-list">
        {progress.subjectProgress.map((subject, index) => {
          const color = progressColors[index % progressColors.length]
          return (
            <div className="progress-subject" key={subject.id}>
              <div className="progress-subject-top"><span><i className={`subject-dot ${color}`} />{subject.name}</span><strong>{subject.percentage}%</strong></div>
              <div className="subject-progress-track"><span className={color} style={{ width: `${subject.percentage}%` }} /></div>
              <small>{subject.completedTopics} of {subject.totalTopics} topics</small>
            </div>
          )
        })}
      </div>

      <div className="weekly-activity">
        <div className="weekly-activity-heading"><div><span className="section-kicker">NEXT SEVEN DAYS</span><h3>Study hours</h3></div><div className="chart-legend"><span><i className="planned-key" />Planned</span><span><i className="completed-key" />Done</span></div></div>
        <div className="weekly-chart" role="img" aria-label="Planned and completed study minutes over the next seven days">
          {progress.weeklyActivity.map((day) => {
            const plannedHeight = Math.round(day.plannedMinutes / chartMaximum * 100)
            const completedHeight = Math.round(day.completedMinutes / chartMaximum * 100)
            return (
              <div className="weekly-chart-column" key={day.date}>
                <div className="weekly-chart-track" title={`${day.label}: ${day.completedMinutes} of ${day.plannedMinutes} minutes complete`}>
                  <span className="weekly-chart-planned" style={{ height: `${plannedHeight}%` }} />
                  <i className="weekly-chart-completed" style={{ height: `${completedHeight}%` }} />
                </div>
                <small>{day.label}</small>
              </div>
            )
          })}
        </div>
      </div>
      <a className="panel-footer-link" href="#calendar">View study calendar <ArrowUpRight size={15} /></a>
    </section>
  )
}