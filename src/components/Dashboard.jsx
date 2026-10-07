import { ArrowUpRight, Sparkles } from 'lucide-react'

export function Dashboard({ completedCount, taskCount }) {
  const today = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

  return (
    <section className="overview-section" id="overview">
      <div className="topline">
        <div className="breadcrumb">YOUR DASHBOARD <span>/</span> OVERVIEW</div>
        <div className="topline-right"><span className="today-date">{today}</span><div className="top-avatar">JD</div></div>
      </div>

      <div className="welcome-panel">
        <div className="welcome-copy">
          <div className="eyebrow"><Sparkles size={14} /> YOUR SPACE TO FOCUS</div>
          <h1>Make today<br />count, Jamie<span>.</span></h1>
          <p>A little progress each day adds up to big results.</p>
          <a className="welcome-link" href="#planner">See today's study plan <ArrowUpRight size={15} /></a>
        </div>
        <div className="welcome-note"><span className="welcome-note-dot" /><strong>{completedCount} of {taskCount}</strong> tasks done today</div>
        <div className="welcome-orbit orbit-one" />
        <div className="welcome-orbit orbit-two" />
      </div>

      <div className="section-heading overview-heading">
        <div><span className="section-kicker">A GOOD DAY TO LEARN</span><h2>Your study snapshot</h2></div>
        <span className="snapshot-note"><span className="live-dot" /> Looking good today</span>
      </div>
    </section>
  )
}