import { useEffect, useMemo, useState } from 'react'
import { Navbar } from './components/Navbar.jsx'
import { Dashboard } from './components/Dashboard.jsx'
import { AddSubject } from './components/AddSubject.jsx'
import { StudyPlanner } from './components/StudyPlanner.jsx'
import { TodaysTasks } from './components/TodaysTasks.jsx'
import { Progress } from './components/Progress.jsx'
import { UpcomingExams } from './components/UpcomingExams.jsx'
import { StatisticCard } from './components/StatisticCard.jsx'
import { StudyCalendar } from './components/StudyCalendar.jsx'
import { AIStudyAssistant } from './components/AIStudyAssistant.jsx'
import { AlarmClock, BookOpen, ChartNoAxesColumnIncreasing, CircleCheck, Layers3, Timer } from 'lucide-react'
import { generateStudyPlanReport } from './utils/generateStudyPlan.js'
import { calculateProgress } from './utils/calculateProgress.js'

const initialTasks = [
  { id: 1, title: 'Review derivatives & limits', subject: 'Mathematics', time: '9:00 AM', duration: '45 min', done: true, color: 'lime' },
  { id: 2, title: 'Read chapter 06: Cell biology', subject: 'Biology', time: '11:30 AM', duration: '60 min', done: false, color: 'blue' },
  { id: 3, title: 'Practice organic reactions', subject: 'Chemistry', time: '2:00 PM', duration: '40 min', done: false, color: 'orange' },
]

const subjectStorageKey = 'studywise-subjects'
const calendarStorageKey = 'studywise-calendar-tasks'
const dailyTaskStorageKey = 'studywise-dashboard-tasks'
const availableHoursStorageKey = 'studywise-available-hours'

function createTopic(id, name, difficulty, estimatedMinutes, completed = false) {
  return { id, name, difficulty, estimatedMinutes, completed }
}

const defaultSubjects = [
  {
    id: 'math', name: 'Mathematics', examDate: '2026-10-19', difficulty: 'Hard', priority: 'High', availableStudyHours: 2,
    topics: [createTopic('math-1', 'Derivatives & limits', 'Medium', 45, true), createTopic('math-2', 'Integral calculus', 'Hard', 60, true)],
  },
  {
    id: 'biology', name: 'Biology', examDate: '2026-10-24', difficulty: 'Medium', priority: 'Medium', availableStudyHours: 1.5,
    topics: [createTopic('biology-1', 'Cell biology', 'Medium', 60, true), createTopic('biology-2', 'Genetics', 'Hard', 45)],
  },
  {
    id: 'chemistry', name: 'Chemistry', examDate: '2026-11-02', difficulty: 'Hard', priority: 'High', availableStudyHours: 1,
    topics: [createTopic('chemistry-1', 'Organic reactions', 'Hard', 40, true), createTopic('chemistry-2', 'Chemical bonding', 'Medium', 35)],
  },
  {
    id: 'computer-organization', name: 'Computer Organization', examDate: '2026-10-20', difficulty: 'Medium', priority: 'High', availableStudyHours: 2,
    topics: [createTopic('computer-1', 'Binary arithmetic review', 'Medium', 30), createTopic('computer-2', 'CPU architecture', 'Hard', 45)],
  },
]

function loadSubjects() {
  try {
    const storedSubjects = localStorage.getItem(subjectStorageKey)
    if (!storedSubjects) return defaultSubjects
    const parsedSubjects = JSON.parse(storedSubjects)
    return Array.isArray(parsedSubjects) ? parsedSubjects : defaultSubjects
  } catch {
    return defaultSubjects
  }
}

function loadCalendarTaskState() {
  try {
    const storedState = localStorage.getItem(calendarStorageKey)
    const parsedState = storedState ? JSON.parse(storedState) : {}
    return parsedState && typeof parsedState === 'object' && !Array.isArray(parsedState) ? parsedState : {}
  } catch {
    return {}
  }
}

function loadDailyTasks() {
  try {
    const storedTasks = localStorage.getItem(dailyTaskStorageKey)
    const parsedTasks = storedTasks ? JSON.parse(storedTasks) : initialTasks
    return Array.isArray(parsedTasks) ? parsedTasks : initialTasks
  } catch {
    return initialTasks
  }
}

function loadAvailableHours() {
  try {
    const savedHours = Number(localStorage.getItem(availableHoursStorageKey))
    return Number.isFinite(savedHours) && savedHours >= 0.5 && savedHours <= 12 ? savedHours : 2
  } catch {
    return 2
  }
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(date, days) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function timeToMinutes(value) {
  const [time, period] = value.split(' ')
  let [hour, minute] = time.split(':').map(Number)
  if (period === 'PM' && hour !== 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0
  return hour * 60 + minute
}

function formatTime(minutes) {
  const hour24 = Math.floor(minutes / 60) % 24
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${String(minutes % 60).padStart(2, '0')} ${hour24 < 12 ? 'AM' : 'PM'}`
}

function reflowCalendarSchedule(studyPlan, taskState, subjects) {
  const tasksByDate = new Map()
  const currentTaskIds = new Set(studyPlan.filter((task) => task.taskType !== 'Break').map((task) => task.id))

  function addToDate(task) {
    const tasks = tasksByDate.get(task.date) ?? []
    tasks.push(task)
    tasksByDate.set(task.date, tasks)
  }

  studyPlan.filter((task) => task.taskType !== 'Break').forEach((task) => {
    const savedState = taskState[task.id] ?? {}
    const date = savedState.date ?? task.date
    addToDate({ ...task, date, completed: Boolean(savedState.completed) })
  })

  Object.values(taskState).filter((state) => state.completed && state.id && !currentTaskIds.has(state.id)).forEach((state) => {
    const subject = subjects.find((item) => item.id === state.subjectId)
    const taskGroupParts = String(state.taskGroupKey ?? '').split(':')
    const topicId = state.topicId ?? (taskGroupParts.length >= 4 ? taskGroupParts[1] : null)
    const topic = subject?.topics.find((item) => item.id === topicId)
    const taskType = state.taskType ?? (taskGroupParts.length >= 4 ? taskGroupParts[2] : 'Learning')
    if (!state.date || !Number.isFinite(Number(state.durationMinutes))) return
    addToDate({
      ...state,
      date: state.date,
      subject: state.subject ?? subject?.name ?? 'Completed subject',
      topic: state.topic ?? topic?.name ?? 'Completed study session',
      topicId,
      taskType,
      completed: true,
    })
  })

  return [...tasksByDate.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .flatMap(([date, tasks]) => {
      const completedTasks = tasks.filter((task) => task.completed).sort((first, second) => timeToMinutes(first.startTime ?? '9:00 AM') - timeToMinutes(second.startTime ?? '9:00 AM'))
      const pendingTasks = tasks.filter((task) => !task.completed).sort((first, second) => timeToMinutes(first.startTime) - timeToMinutes(second.startTime))
      const orderedTasks = [...completedTasks, ...pendingTasks]
      const events = []
      let cursor = 9 * 60
      orderedTasks.forEach((task, index) => {
        if (index > 0) {
          events.push({
            id: `break:${date}:${index}`,
            subjectId: null,
            date,
            startTime: formatTime(cursor),
            endTime: formatTime(cursor + 10),
            subject: 'Break',
            topic: 'Short break',
            durationMinutes: 10,
            taskType: 'Break',
            completed: false,
          })
          cursor += 10
        }
        if (task.completed && task.startTime) cursor = Math.max(cursor, timeToMinutes(task.startTime))
        events.push({ ...task, startTime: formatTime(cursor), endTime: formatTime(cursor + task.durationMinutes) })
        cursor += task.durationMinutes
      })
      return events
    })
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function App() {
  const [subjects, setSubjects] = useState(loadSubjects)
  const [tasks, setTasks] = useState(loadDailyTasks)
  const [availableHoursPerDay, setAvailableHoursPerDay] = useState(loadAvailableHours)
  const [calendarTaskState, setCalendarTaskState] = useState(loadCalendarTaskState)
  const [planGeneration, setPlanGeneration] = useState(0)
  const [adaptiveNotice, setAdaptiveNotice] = useState('')
  const [createSubjectRequest, setCreateSubjectRequest] = useState(0)
  const [activePage, setActivePage] = useState(() => {
    if (window.location.hash === '#calendar') return 'calendar'
    if (window.location.hash === '#assistant') return 'assistant'
    return 'dashboard'
  })
  useEffect(() => {
    try {
      localStorage.setItem(subjectStorageKey, JSON.stringify(subjects))
    } catch {}
  }, [subjects])
  useEffect(() => {
    try {
      localStorage.setItem(calendarStorageKey, JSON.stringify(calendarTaskState))
    } catch {}
  }, [calendarTaskState])
  useEffect(() => {
    try {
      localStorage.setItem(dailyTaskStorageKey, JSON.stringify(tasks))
    } catch {}
  }, [tasks])
  useEffect(() => {
    try {
      localStorage.setItem(availableHoursStorageKey, String(availableHoursPerDay))
    } catch {}
  }, [availableHoursPerDay])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcomingExamSubjects = subjects
    .filter((subject) => subject.examDate && new Date(`${subject.examDate}T00:00:00`) >= today)
    .sort((first, second) => first.examDate.localeCompare(second.examDate))
  const nextExamDaysAway = upcomingExamSubjects.length
    ? Math.ceil((new Date(`${upcomingExamSubjects[0].examDate}T00:00:00`) - today) / 86_400_000)
    : null
  const todayKey = dateKey(today)
  const missedTaskEntries = Object.entries(calendarTaskState).filter(([, state]) => state.missed)
  const completedCalendarSessions = Object.values(calendarTaskState).filter((state) => state.completed && state.taskKey)
  const completedTaskKeys = [...new Set(completedCalendarSessions
    .filter((state) => !state.taskGroupKey)
    .map((state) => state.taskKey))].sort()
  const completedTaskSegments = completedCalendarSessions
    .filter((state) => state.taskGroupKey)
    .map((state) => ({ taskGroupKey: state.taskGroupKey, offsetMinutes: state.taskOffsetMinutes, durationMinutes: state.durationMinutes }))
  const completedMinutesByDate = {}
  const completedMinutesBySubjectAndDate = {}
  completedCalendarSessions.forEach((state) => {
    const durationMinutes = Number(state.durationMinutes)
    if (!state.date || !Number.isFinite(durationMinutes) || durationMinutes <= 0) return
    completedMinutesByDate[state.date] = (completedMinutesByDate[state.date] ?? 0) + durationMinutes
    if (state.subjectId) {
      const key = `${state.subjectId}:${state.date}`
      completedMinutesBySubjectAndDate[key] = (completedMinutesBySubjectAndDate[key] ?? 0) + durationMinutes
    }
  })
  const completedTaskSegmentsKey = completedTaskSegments
    .map((segment) => `${segment.taskGroupKey}:${segment.offsetMinutes}:${segment.durationMinutes}`)
    .sort()
    .join('|')
  const completedCapacityKey = [
    ...Object.entries(completedMinutesByDate),
    ...Object.entries(completedMinutesBySubjectAndDate),
  ].map(([date, minutes]) => `${date}:${minutes}`).sort().join('|')
  const missedTopicIds = [...new Set(missedTaskEntries.flatMap(([, state]) => state.topicIds?.length ? state.topicIds : state.topicId ? [state.topicId] : []))].sort()
  const latestMissedDate = missedTaskEntries
    .map(([, state]) => state.missedOn ?? state.date)
    .filter(Boolean)
    .sort()
    .at(-1)
  const latestMissedState = [...missedTaskEntries]
    .sort(([, first], [, second]) => String(first.missedOn ?? first.date).localeCompare(String(second.missedOn ?? second.date)))
    .at(-1)?.[1]
  const visibleAdaptiveNotice = adaptiveNotice || latestMissedState?.missedMessage || ''
  const nextStudyDate = latestMissedDate ? dateKey(addDays(new Date(`${latestMissedDate}T00:00:00`), 1)) : todayKey
  const adaptiveStartDate = nextStudyDate < todayKey ? todayKey : nextStudyDate
  const completedTaskKeysKey = completedTaskKeys.join('|')
  const missedTopicIdsKey = missedTopicIds.join('|')
  const planReport = useMemo(() => generateStudyPlanReport(subjects, availableHoursPerDay, today, {
    startDate: adaptiveStartDate,
    completedTaskKeys,
    completedTaskSegments,
    completedMinutesByDate,
    completedMinutesBySubjectAndDate,
    missedTopicIds,
  }), [subjects, availableHoursPerDay, todayKey, adaptiveStartDate, completedTaskKeysKey, completedTaskSegmentsKey, completedCapacityKey, missedTopicIdsKey, planGeneration])
  const calendarSchedule = reflowCalendarSchedule(planReport.schedule, calendarTaskState, subjects)
  const progressStats = calculateProgress({ subjects, studySchedule: calendarSchedule, dailyTasks: tasks, calendarHistory: Object.values(calendarTaskState) })
  const assistantContext = {
    currentDate: dateKey(today),
    availableHoursPerDay,
    subjects: subjects.map((subject) => ({
      name: subject.name,
      examDate: subject.examDate || null,
      difficulty: subject.difficulty,
      priority: subject.priority,
      availableStudyHours: subject.availableStudyHours,
      topics: subject.topics.map((topic) => ({
        name: topic.name,
        difficulty: topic.difficulty,
        estimatedMinutes: topic.estimatedMinutes,
        completed: topic.completed,
        needsRevision: Boolean(topic.needsRevision),
      })),
    })),
    upcomingExams: upcomingExamSubjects.map((subject) => ({ name: subject.name, examDate: subject.examDate, priority: subject.priority })),
    upcomingStudySessions: calendarSchedule
      .filter((session) => session.taskType !== 'Break')
      .slice(0, 32)
      .map((session) => ({ date: session.date, startTime: session.startTime, subject: session.subject, topic: session.topic, durationMinutes: session.durationMinutes, taskType: session.taskType, completed: session.completed })),
    todayTasks: tasks.map((task) => ({ title: task.title, subject: task.subject, duration: task.duration, completed: task.done })),
    progress: {
      overallPercentage: progressStats.overallPercentage,
      completedTopics: progressStats.completedTopics,
      remainingTopics: progressStats.remainingTopics,
      completedStudyMinutes: progressStats.completedStudyMinutes,
      plannedStudyMinutes: progressStats.plannedStudyMinutes,
      todayCompletionRate: progressStats.todayCompletionRate,
    },
  }
  const { totalTopics, completedTopics, overallPercentage } = progressStats
  const statistics = [
    { label: 'Total subjects', value: subjects.length, detail: 'Across your study plan', icon: BookOpen, tone: 'green' },
    { label: 'Total topics', value: totalTopics, detail: 'Ready to work through', icon: Layers3, tone: 'blue' },
      { label: "Today's study hours", value: '2 hrs', detail: 'Available today', icon: Timer, tone: 'peach' },
    { label: 'Completed topics', value: completedTopics, detail: `Of ${totalTopics} total topics`, icon: CircleCheck, tone: 'yellow' },
    { label: 'Overall progress', value: `${overallPercentage}%`, detail: 'Keep your momentum', icon: ChartNoAxesColumnIncreasing, tone: 'mint' },
    { label: 'Upcoming exams', value: upcomingExamSubjects.length, detail: nextExamDaysAway === null ? 'No exam dates set' : nextExamDaysAway === 0 ? 'Next exam is today' : `Next one in ${nextExamDaysAway} days`, icon: AlarmClock, tone: 'lavender' },
  ]

  function saveSubject(subject) {
    setSubjects((current) => {
      const exists = current.some((item) => item.id === subject.id)
      return exists
        ? current.map((item) => item.id === subject.id ? { ...item, ...subject } : item)
        : [...current, { ...subject, id: createId() }]
    })
  }

  function deleteSubject(subjectId) {
    setSubjects((current) => current.filter((subject) => subject.id !== subjectId))
  }

  function addTopic(subjectId, topic) {
    setSubjects((current) => current.map((subject) => (
      subject.id === subjectId ? { ...subject, topics: [...subject.topics, { ...topic, id: createId() }] } : subject
    )))
  }

  function deleteTopic(subjectId, topicId) {
    setSubjects((current) => current.map((subject) => (
      subject.id === subjectId ? { ...subject, topics: subject.topics.filter((topic) => topic.id !== topicId) } : subject
    )))
  }

  function toggleTopic(subjectId, topicId) {
    setSubjects((current) => current.map((subject) => (
      subject.id === subjectId
        ? { ...subject, topics: subject.topics.map((topic) => topic.id === topicId ? { ...topic, completed: !topic.completed } : topic) }
        : subject
    )))
  }

  function toggleTopicRevision(subjectId, topicId) {
    setSubjects((current) => current.map((subject) => (
      subject.id === subjectId
        ? { ...subject, topics: subject.topics.map((topic) => topic.id === topicId ? { ...topic, needsRevision: !topic.needsRevision } : topic) }
        : subject
    )))
  }

  function toggleTask(taskId) {
    setTasks((current) => current.map((task) => (
      task.id === taskId ? { ...task, done: !task.done } : task
    )))
  }

  function updateStudyTask(taskId, updates) {
    setCalendarTaskState((current) => ({
      ...current,
      [taskId]: { ...current[taskId], id: taskId, ...updates },
    }))
  }

  function toggleStudyTaskComplete(task) {
    updateStudyTask(task.id, {
      completed: !task.completed,
      missed: false,
      taskKey: task.taskKey,
      taskGroupKey: task.taskGroupKey,
      taskOffsetMinutes: task.taskOffsetMinutes,
      date: task.date,
      startTime: task.startTime,
      endTime: task.endTime,
      durationMinutes: task.durationMinutes,
      subjectId: task.subjectId,
      subject: task.subject,
      topic: task.topic,
      topicId: task.topicId,
      topicIds: task.topicIds,
      taskType: task.taskType,
    })
  }

  function markStudyTaskMissed(task) {
    const missedTopicIdsForTask = task.topicIds?.length ? task.topicIds : task.topicId ? [task.topicId] : []
    const nextDate = dateKey(addDays(new Date(`${task.date}T00:00:00`), 1))
    const previouslyMissedTopicIds = missedTaskEntries.flatMap(([, state]) => state.topicIds?.length ? state.topicIds : state.topicId ? [state.topicId] : [])
    const preview = generateStudyPlanReport(subjects, availableHoursPerDay, today, {
      startDate: nextDate,
      completedTaskKeys,
      completedTaskSegments,
      completedMinutesByDate,
      completedMinutesBySubjectAndDate,
      missedTopicIds: [...new Set([...previouslyMissedTopicIds, ...missedTopicIdsForTask])],
    })
    const movedToTomorrow = preview.schedule.some((session) => session.date === nextDate && (
      missedTopicIdsForTask.includes(session.topicId) || session.topicIds?.some((topicId) => missedTopicIdsForTask.includes(topicId))
    ))
    const message = movedToTomorrow
      ? `You missed today's ${task.topic} session. Your plan has been automatically adjusted and the topic has been moved to tomorrow.`
      : `You missed today's ${task.topic} session. Your plan was adjusted, but this topic won't fit before its exam without exceeding your available study hours.`

    updateStudyTask(task.id, {
      date: task.date,
      missed: true,
      missedOn: task.date,
      completed: false,
      taskKey: task.taskKey,
      subjectId: task.subjectId,
      subject: task.subject,
      topic: task.topic,
      topicId: task.topicId,
      topicIds: task.topicIds,
      taskGroupKey: task.taskGroupKey,
      taskOffsetMinutes: task.taskOffsetMinutes,
      taskType: task.taskType,
      durationMinutes: task.durationMinutes,
      movedToDate: movedToTomorrow ? nextDate : null,
      missedMessage: message,
    })
    setAdaptiveNotice(message)
    setPlanGeneration((generation) => generation + 1)
  }

  function regeneratePlan() {
    setPlanGeneration((generation) => generation + 1)
    if (planReport.unscheduledTopics.length) {
      setAdaptiveNotice(`Plan regenerated. ${planReport.unscheduledTopics.length} topic${planReport.unscheduledTopics.length === 1 ? ' remains' : 's remain'} unscheduled because there isn't enough study time before the exam.`)
    } else {
      setAdaptiveNotice('Plan regenerated using your remaining topics, available hours, and exam dates.')
    }
  }

  function rescheduleStudyTask(taskId, nextDate) {
    const task = calendarSchedule.find((item) => item.id === taskId && item.taskType !== 'Break')
    if (!task || !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return false
    const nextDay = new Date(`${nextDate}T00:00:00`)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (nextDay < today || nextDay > addDays(today, 6)) return false

    const subject = subjects.find((item) => item.id === task.subjectId)
    if (subject?.examDate && nextDate >= subject.examDate) return false

    const targetDayMinutes = calendarSchedule
      .filter((item) => item.date === nextDate && item.id !== taskId && item.taskType !== 'Break')
      .reduce((total, item) => total + item.durationMinutes, 0)
    if (targetDayMinutes + task.durationMinutes > availableHoursPerDay * 60) return false

    const targetSubjectMinutes = calendarSchedule
      .filter((item) => item.date === nextDate && item.id !== taskId && item.subjectId === task.subjectId)
      .reduce((total, item) => total + item.durationMinutes, 0)
    if (subject && targetSubjectMinutes + task.durationMinutes > subject.availableStudyHours * 60) return false

    updateStudyTask(taskId, { date: nextDate })
    return true
  }

  function navigateTo(page, anchor) {
    setActivePage(page)
    if (anchor === 'add-subject') setCreateSubjectRequest((request) => request + 1)
    window.history.replaceState(null, '', anchor ? `#${anchor}` : page === 'calendar' ? '#calendar' : page === 'assistant' ? '#assistant' : '#overview')
    if (anchor) {
      requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' }))
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="app-shell">
      <Navbar activePage={activePage} onNavigate={navigateTo} />
      <main className="main-content">
        {activePage === 'calendar' ? (
          <StudyCalendar
            schedule={calendarSchedule}
            subjects={subjects}
            onNavigate={navigateTo}
            onToggleComplete={toggleStudyTaskComplete}
            onReschedule={rescheduleStudyTask}
            onMarkMissed={markStudyTaskMissed}
            onRegeneratePlan={regeneratePlan}
            missedNotice={visibleAdaptiveNotice}
            unscheduledTopics={planReport.unscheduledTopics}
            validationIssues={planReport.validationIssues}
            availableHoursPerDay={availableHoursPerDay}
          />
        ) : activePage === 'assistant' ? (
          <AIStudyAssistant
            context={assistantContext}
            availableHoursPerDay={availableHoursPerDay}
            onAvailableHoursChange={setAvailableHoursPerDay}
          />
        ) : <>
        <Dashboard completedCount={tasks.filter((task) => task.done).length} taskCount={tasks.length} />
        <div className="statistics-grid" aria-label="Study statistics">
          {statistics.map((statistic) => <StatisticCard key={statistic.label} {...statistic} />)}
        </div>
        <div className="dashboard-grid">
          <div className="dashboard-primary">
            <StudyPlanner schedule={planReport.schedule} />
          </div>
          <div className="dashboard-secondary">
            <UpcomingExams subjects={subjects} />
            <Progress subjects={subjects} progress={progressStats} />
          </div>
        </div>
        <div className="utility-grid">
          <TodaysTasks tasks={tasks} onToggleTask={toggleTask} />
        </div>
        <AddSubject
          createRequest={createSubjectRequest}
          subjects={subjects}
          onSaveSubject={saveSubject}
          onDeleteSubject={deleteSubject}
          onAddTopic={addTopic}
          onDeleteTopic={deleteTopic}
          onToggleTopic={toggleTopic}
          onToggleTopicRevision={toggleTopicRevision}
        />
        </>}
        <footer className="page-footer">Small steps, big momentum. Keep showing up.</footer>
      </main>
    </div>
  )
}