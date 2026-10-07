import { Check, Circle, Clock3, ListChecks } from 'lucide-react'

export function TodaysTasks({ tasks, onToggleTask }) {
  const completeCount = tasks.filter((task) => task.done).length

  return (
    <section className="surface-panel tasks-panel" id="tasks">
      <div className="tasks-heading">
        <div className="panel-heading">
          <div className="heading-icon heading-icon-yellow"><ListChecks size={18} /></div>
          <div><span className="section-kicker">ONE THING AT A TIME</span><h2>Today's tasks</h2></div>
        </div>
        <span className="task-counter">{completeCount} of {tasks.length} done</span>
      </div>
      <div className="task-progress-track"><span style={{ width: `${tasks.length ? (completeCount / tasks.length) * 100 : 0}%` }} /></div>
      <div className="task-list">
        {tasks.map((task) => (
          <label className={`task-row${task.done ? ' task-complete' : ''}`} key={task.id}>
            <input type="checkbox" checked={task.done} onChange={() => onToggleTask(task.id)} />
            <span className={`task-check ${task.done ? 'checked' : ''}`}>{task.done ? <Check size={14} /> : <Circle size={19} />}</span>
            <span className={`task-color ${task.color}`} />
            <span className="task-copy"><strong>{task.title}</strong><small>{task.subject}</small></span>
            <span className="task-time"><Clock3 size={13} />{task.time}<span>{task.duration}</span></span>
          </label>
        ))}
      </div>
      <button className="add-task-button" type="button"><span>+</span> Add a task</button>
    </section>
  )
}