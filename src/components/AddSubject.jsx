import { useEffect, useState } from 'react'
import { BookPlus, CalendarDays, Check, ChevronDown, Clock3, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'

const emptyTopic = () => ({ name: '', difficulty: 'Medium', estimatedMinutes: 30 })
const emptySubject = () => ({
  name: '',
  examDate: '',
  difficulty: 'Medium',
  priority: 'Medium',
  availableStudyHours: 2,
  topics: [],
})

function localDateInputValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function AddSubject({ createRequest, subjects, onSaveSubject, onDeleteSubject, onAddTopic, onDeleteTopic, onToggleTopic, onToggleTopicRevision }) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [subjectForm, setSubjectForm] = useState(emptySubject)
  const [topicForm, setTopicForm] = useState(emptyTopic)
  const [formError, setFormError] = useState('')
  const [cardTopicError, setCardTopicError] = useState('')
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  function openCreateForm() {
    setEditingId(null)
    setSubjectForm(emptySubject())
    setFormError('')
    setCardTopicError('')
    setFormOpen(true)
  }

  useEffect(() => {
    if (createRequest > 0) openCreateForm()
  }, [createRequest])

  function openEditForm(subject) {
    setEditingId(subject.id)
    setSubjectForm({
      name: subject.name,
      examDate: subject.examDate,
      difficulty: subject.difficulty,
      priority: subject.priority,
      availableStudyHours: subject.availableStudyHours,
      topics: subject.topics.map((topic) => ({ ...topic })),
    })
    setTopicForm(emptyTopic())
    setFormError('')
    setCardTopicError('')
    setFormOpen(true)
  }

  function updateSubjectField(event) {
    const { name, value } = event.target
    setSubjectForm((current) => ({ ...current, [name]: name === 'availableStudyHours' ? Number(value) : value }))
    setFormError('')
  }

  function addDraftTopic() {
    const name = topicForm.name.trim()
    const estimatedMinutes = Number(topicForm.estimatedMinutes)
    if (!name) {
      setFormError('Enter a topic name before adding it.')
      return
    }
    if (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 5 || estimatedMinutes > 600) {
      setFormError('Topic estimates must be between 5 and 600 minutes.')
      return
    }
    setSubjectForm((current) => ({ ...current, topics: [...current.topics, { ...topicForm, id: `draft-${Date.now()}-${Math.random()}`, name, completed: false }] }))
    setTopicForm(emptyTopic())
    setFormError('')
  }

  function removeDraftTopic(topicId) {
    setSubjectForm((current) => ({ ...current, topics: current.topics.filter((topic) => topic.id !== topicId) }))
  }

  function handleSaveSubject(event) {
    event.preventDefault()
    const name = subjectForm.name.trim()
    if (!name) {
      setFormError('Enter a subject name to continue.')
      return
    }
    if (!subjectForm.examDate) {
      setFormError('Choose an exam date to continue.')
      return
    }
    if (subjectForm.examDate < localDateInputValue()) {
      setFormError('Exam date cannot be in the past.')
      return
    }
    const availableStudyHours = Number(subjectForm.availableStudyHours)
    if (!Number.isFinite(availableStudyHours) || availableStudyHours < 0.5 || availableStudyHours > 24) {
      setFormError('Available study hours must be between 0.5 and 24 per day.')
      return
    }
    const duplicate = subjects.some((subject) => subject.name.toLowerCase() === name.toLowerCase() && subject.id !== editingId)
    if (duplicate) {
      setFormError('A subject with this name already exists.')
      return
    }
    onSaveSubject({ ...subjectForm, availableStudyHours, name, id: editingId ?? undefined })
    setFormOpen(false)
    setEditingId(null)
    setFormError('')
  }

  function handleAddCardTopic(subjectId, topic) {
    const name = topic.name.trim()
    const estimatedMinutes = Number(topic.estimatedMinutes)
    if (!name) {
      setCardTopicError('Enter a topic name.')
      return
    }
    if (!Number.isFinite(estimatedMinutes) || estimatedMinutes < 5 || estimatedMinutes > 600) {
      setCardTopicError('Estimate must be 5–600 minutes.')
      return
    }
    onAddTopic(subjectId, { ...topic, name, estimatedMinutes, completed: false })
    setTopicForm(emptyTopic())
    setCardTopicError('')
  }

  function toggleExpanded(subjectId) {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(subjectId)) next.delete(subjectId)
      else next.add(subjectId)
      return next
    })
  }

  return (
    <section className="subject-manager" id="add-subject">
      <div className="subject-manager-heading">
        <div>
          <span className="section-kicker">YOUR COURSE LOAD</span>
          <h2>Subjects <span>{subjects.length}</span></h2>
          <p>Set up each course, then break it into manageable topics.</p>
        </div>
        <button className="primary-button subject-create-button" type="button" onClick={openCreateForm}><Plus size={16} /> Add subject</button>
      </div>

      {formOpen && (
        <form className="subject-editor" onSubmit={handleSaveSubject}>
          <div className="editor-heading">
            <div className="panel-heading">
              <div className="heading-icon heading-icon-peach"><BookPlus size={18} /></div>
              <div><span className="section-kicker">SUBJECT DETAILS</span><h3>{editingId ? 'Edit subject' : 'Add a subject'}</h3></div>
            </div>
            <button className="icon-button" type="button" onClick={() => setFormOpen(false)} aria-label="Close subject form"><X size={17} /></button>
          </div>

          <div className="subject-fields-grid">
            <label className="form-field form-field-wide"><span>Subject name</span><input autoFocus name="name" value={subjectForm.name} onChange={updateSubjectField} onInvalid={(event) => { event.preventDefault(); setFormError('Enter a subject name to continue.') }} placeholder="e.g. World History" maxLength={48} required /></label>
            <label className="form-field"><span>Exam date</span><input name="examDate" type="date" min={localDateInputValue()} value={subjectForm.examDate} onChange={updateSubjectField} onInvalid={(event) => { event.preventDefault(); setFormError(event.currentTarget.validity.valueMissing ? 'Choose an exam date to continue.' : 'Exam date cannot be in the past.') }} required /></label>
            <label className="form-field"><span>Subject difficulty</span><select name="difficulty" value={subjectForm.difficulty} onChange={updateSubjectField}><option>Easy</option><option>Medium</option><option>Hard</option></select></label>
            <label className="form-field"><span>Priority</span><select name="priority" value={subjectForm.priority} onChange={updateSubjectField}><option>Low</option><option>Medium</option><option>High</option></select></label>
            <label className="form-field"><span>Available study hours</span><input name="availableStudyHours" type="number" min="0.5" max="24" step="0.5" value={subjectForm.availableStudyHours} onChange={updateSubjectField} onInvalid={(event) => { event.preventDefault(); setFormError('Available study hours must be between 0.5 and 24 per day.') }} required /></label>
          </div>

          <div className="topic-editor">
            <div className="topic-editor-title"><div><strong>Topics / chapters</strong><span>Add the areas you want to study.</span></div><span className="topic-count">{subjectForm.topics.length} added</span></div>
            <div className="topic-input-row">
              <input aria-label="Topic name" value={topicForm.name} onChange={(event) => { setTopicForm((current) => ({ ...current, name: event.target.value })); setFormError('') }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addDraftTopic() } }} placeholder="Topic or chapter name" maxLength={60} />
              <select aria-label="Topic difficulty" value={topicForm.difficulty} onChange={(event) => setTopicForm((current) => ({ ...current, difficulty: event.target.value }))}><option>Easy</option><option>Medium</option><option>Hard</option></select>
              <label className="topic-time-input"><Clock3 size={14} /><input aria-label="Estimated study time in minutes" type="number" min="5" max="600" step="5" value={topicForm.estimatedMinutes} onChange={(event) => { setTopicForm((current) => ({ ...current, estimatedMinutes: Number(event.target.value) })); setFormError('') }} /><span>min</span></label>
              <button className="icon-button topic-add-button" type="button" onClick={addDraftTopic} aria-label="Add topic"><Plus size={17} /></button>
            </div>
            {subjectForm.topics.length > 0 && <div className="draft-topic-list">
              {subjectForm.topics.map((topic) => <div className="draft-topic-row" key={topic.id}><span className={`difficulty-pill ${topic.difficulty.toLowerCase()}`}>{topic.difficulty}</span><strong>{topic.name}</strong><span>{topic.estimatedMinutes} min</span><button className="icon-button subtle-icon-button" type="button" onClick={() => removeDraftTopic(topic.id)} aria-label={`Remove ${topic.name}`}><X size={14} /></button></div>)}
            </div>}
          </div>

          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="editor-actions"><button className="secondary-button" type="button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-button" type="submit"><Check size={16} />{editingId ? 'Save changes' : 'Save subject'}</button></div>
        </form>
      )}

      {subjects.length === 0 ? (
        <div className="empty-subject-state"><div className="heading-icon heading-icon-green"><BookPlus size={19} /></div><strong>No subjects yet</strong><span>Add your first subject to start organizing your study plan.</span><button className="secondary-button" type="button" onClick={openCreateForm}><Plus size={15} /> Create a subject</button></div>
      ) : (
        <div className="subject-card-grid">
          {subjects.map((subject, index) => {
            const completed = subject.topics.filter((topic) => topic.completed).length
            const percent = subject.topics.length ? Math.round(completed / subject.topics.length * 100) : 0
            const expanded = expandedIds.has(subject.id)
            const cardTopicForm = expandedIds.has(`topic-form-${subject.id}`)
            return (
              <article className="managed-subject-card" key={subject.id}>
                <div className="managed-card-topline"><span className={`subject-dot ${['lime', 'blue', 'coral', 'violet', 'yellow', 'mint'][index % 6]}`} /><span className={`priority-pill ${subject.priority.toLowerCase()}`}>{subject.priority} priority</span><div className="card-actions"><button className="icon-button" type="button" onClick={() => openEditForm(subject)} aria-label={`Edit ${subject.name}`} title="Edit subject"><Pencil size={14} /></button><button className="icon-button delete-icon-button" type="button" onClick={() => { if (window.confirm(`Delete ${subject.name} and all its topics?`)) onDeleteSubject(subject.id) }} aria-label={`Delete ${subject.name}`} title="Delete subject"><Trash2 size={14} /></button></div></div>
                <h3>{subject.name}</h3>
                <div className="managed-subject-meta"><span className={`difficulty-pill ${subject.difficulty.toLowerCase()}`}>{subject.difficulty}</span><span><CalendarDays size={13} />{subject.examDate ? new Date(`${subject.examDate}T00:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No exam date'}</span><span><Clock3 size={13} />{subject.availableStudyHours} hrs available</span></div>
                <div className="managed-progress-heading"><span>{completed} of {subject.topics.length} topics complete</span><strong>{percent}%</strong></div>
                <div className="managed-progress-track"><span style={{ width: `${percent}%` }} /></div>

                <button className="topics-toggle" type="button" onClick={() => toggleExpanded(subject.id)} aria-expanded={expanded}><span>{expanded ? 'Hide topics' : 'View topics'} <span className="topics-total">{subject.topics.length}</span></span><ChevronDown size={15} className={expanded ? 'chevron-open' : ''} /></button>
                {expanded && <div className="managed-topics">
                  {subject.topics.length === 0 && <p className="no-topics-message">No topics yet. Add one below.</p>}
                  {subject.topics.map((topic) => <div className={`managed-topic-row${topic.completed ? ' topic-is-complete' : ''}`} key={topic.id}>
                    <label className="topic-completion-control"><input type="checkbox" checked={topic.completed} onChange={() => onToggleTopic(subject.id, topic.id)} /><span className="topic-checkbox">{topic.completed && <Check size={12} />}</span></label>
                    <span className="managed-topic-name">{topic.name}</span><span className={`difficulty-pill ${topic.difficulty.toLowerCase()}`}>{topic.difficulty}</span><span className="topic-estimate">{topic.estimatedMinutes}m</span>{topic.completed && <button className={`icon-button revision-toggle${topic.needsRevision ? ' is-active' : ''}`} type="button" onClick={() => onToggleTopicRevision(subject.id, topic.id)} aria-label={topic.needsRevision ? `Remove ${topic.name} from revision` : `Mark ${topic.name} for revision`} aria-pressed={Boolean(topic.needsRevision)} title={topic.needsRevision ? 'Revision scheduled' : 'Mark for revision'}><RotateCcw size={13} /></button>}<button className="icon-button subtle-icon-button" type="button" onClick={() => onDeleteTopic(subject.id, topic.id)} aria-label={`Delete topic ${topic.name}`}><Trash2 size={13} /></button>
                  </div>)}
                  {cardTopicForm ? (
                    <div className="quick-topic-form">
                      <input aria-label={`Topic name for ${subject.name}`} placeholder="New topic name" value={topicForm.name} onChange={(event) => { setTopicForm((current) => ({ ...current, name: event.target.value })); setCardTopicError('') }} />
                      <select aria-label="New topic difficulty" value={topicForm.difficulty} onChange={(event) => setTopicForm((current) => ({ ...current, difficulty: event.target.value }))}><option>Easy</option><option>Medium</option><option>Hard</option></select>
                      <input aria-label="Estimated minutes" type="number" min="5" max="600" step="5" value={topicForm.estimatedMinutes} onChange={(event) => { setTopicForm((current) => ({ ...current, estimatedMinutes: Number(event.target.value) })); setCardTopicError('') }} />
                      <button className="icon-button topic-add-button" type="button" onClick={() => handleAddCardTopic(subject.id, topicForm)} aria-label="Save topic"><Check size={15} /></button>
                      <button className="icon-button subtle-icon-button" type="button" onClick={() => { setExpandedIds((current) => { const next = new Set(current); next.delete(`topic-form-${subject.id}`); return next }); setTopicForm(emptyTopic()) }} aria-label="Cancel adding topic"><X size={14} /></button>
                      {cardTopicError && <span className="card-topic-error" role="alert">{cardTopicError}</span>}
                    </div>
                  ) : <button className="inline-add-topic" type="button" onClick={() => { setTopicForm(emptyTopic()); setExpandedIds((current) => new Set(current).add(`topic-form-${subject.id}`)) }}><Plus size={14} /> Add topic</button>}
                </div>}
              </article>
            )
          })}
        </div>
      )}
      <span className="sr-only" aria-live="polite">{subjects.length} subjects in your study plan</span>
    </section>
  )
}