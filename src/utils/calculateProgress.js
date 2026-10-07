function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function shiftDate(date, days) {
  const shifted = new Date(date)
  shifted.setDate(shifted.getDate() + days)
  return shifted
}

export function calculateProgress({ subjects = [], studySchedule = [], dailyTasks = [], calendarHistory = [], currentDate = new Date() }) {
  const today = new Date(currentDate)
  today.setHours(0, 0, 0, 0)
  const todayKey = localDateKey(today)
  const subjectProgress = subjects.map((subject) => {
    const topics = Array.isArray(subject.topics) ? subject.topics : []
    const completedTopics = topics.filter((topic) => topic.completed).length
    return {
      id: subject.id,
      name: subject.name,
      totalTopics: topics.length,
      completedTopics,
      percentage: topics.length ? Math.round((completedTopics / topics.length) * 100) : 0,
    }
  })
  const totalTopics = subjectProgress.reduce((total, subject) => total + subject.totalTopics, 0)
  const completedTopics = subjectProgress.reduce((total, subject) => total + subject.completedTopics, 0)
  const studySessions = studySchedule.filter((task) => task.taskType !== 'Break')
  const currentSessionIds = new Set(studySessions.map((task) => task.id))
  const archivedSessions = calendarHistory.filter((task) => task && !currentSessionIds.has(task.id) && (task.completed || task.missed))
  const plannedStudyMinutes = studySessions.reduce((total, task) => total + Number(task.durationMinutes || 0), 0)
    + archivedSessions.reduce((total, task) => total + Number(task.durationMinutes || 0), 0)
  const completedStudyMinutes = studySessions
    .filter((task) => task.completed)
    .reduce((total, task) => total + Number(task.durationMinutes || 0), 0)
    + archivedSessions.filter((task) => task.completed).reduce((total, task) => total + Number(task.durationMinutes || 0), 0)
  const todaySessions = [
    ...studySessions.filter((task) => task.date === todayKey),
    ...archivedSessions.filter((task) => task.date === todayKey),
  ]
  const completedTodayTasks = dailyTasks.filter((task) => task.done).length
    + todaySessions.filter((task) => task.completed).length
  const totalTodayTasks = dailyTasks.length + todaySessions.length

  const weeklyActivity = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDate(today, index)
    const dateKey = localDateKey(date)
    const daySessions = [
      ...studySessions.filter((task) => task.date === dateKey),
      ...archivedSessions.filter((task) => task.date === dateKey),
    ]
    const plannedMinutes = daySessions.reduce((total, task) => total + Number(task.durationMinutes || 0), 0)
    const completedMinutes = daySessions
      .filter((task) => task.completed)
      .reduce((total, task) => total + Number(task.durationMinutes || 0), 0)
    return {
      date: dateKey,
      label: date.toLocaleDateString('en', { weekday: 'short' }),
      plannedMinutes,
      completedMinutes,
    }
  })

  return {
    totalTopics,
    completedTopics,
    remainingTopics: totalTopics - completedTopics,
    overallPercentage: totalTopics ? Math.round((completedTopics / totalTopics) * 100) : 0,
    subjectProgress,
    plannedStudyMinutes,
    completedStudyMinutes,
    todayCompletedTasks: completedTodayTasks,
    todayTotalTasks: totalTodayTasks,
    todayCompletionRate: totalTodayTasks ? Math.round((completedTodayTasks / totalTodayTasks) * 100) : 0,
    weeklyActivity,
  }
}