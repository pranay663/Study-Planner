const breakMinutes = 10
const maximumSessionMinutes = 45
const planningDaysWithoutExam = 14
const planningHorizonDays = 365

const difficultyMultipliers = { easy: 1, medium: 1.15, hard: 1.4 }
const priorityMultipliers = { low: 0.8, medium: 1, high: 1.25 }
const priorityRanks = { high: 3, medium: 2, low: 1 }
const difficultyRanks = { hard: 3, medium: 2, easy: 1 }
const validDifficulties = new Set(['easy', 'medium', 'hard'])
const validPriorities = new Set(['low', 'medium', 'high'])

function normalizeDate(value) {
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return null
    const year = Number(match[1])
    const month = Number(match[2]) - 1
    const day = Number(match[3])
    const parsedDate = new Date(Date.UTC(year, month, day))
    if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() !== month || parsedDate.getUTCDate() !== day) return null
    return parsedDate
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null
  return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
}

function dateKey(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date, count) {
  const nextDate = new Date(date)
  nextDate.setUTCDate(nextDate.getUTCDate() + count)
  return nextDate
}

function roundToFive(minutes) {
  return Math.ceil(minutes / 5) * 5
}

function difficultyMultiplier(value) {
  return difficultyMultipliers[String(value ?? 'medium').toLowerCase()] ?? difficultyMultipliers.medium
}

function priorityMultiplier(value) {
  return priorityMultipliers[String(value ?? 'medium').toLowerCase()] ?? priorityMultipliers.medium
}

function topicStudyMinutes(topic, subject) {
  const estimate = Number(topic.estimatedMinutes)
  const baseMinutes = Number.isFinite(estimate) && estimate > 0 ? estimate : 30
  return Math.max(10, roundToFive(
    baseMinutes * difficultyMultiplier(topic.difficulty ?? subject.difficulty) * priorityMultiplier(subject.priority),
  ))
}

function makeLearningSegments(totalMinutes) {
  const segments = []
  let remaining = totalMinutes

  while (remaining > maximumSessionMinutes) {
    let segmentMinutes = maximumSessionMinutes
    if (remaining - segmentMinutes < 15) segmentMinutes = remaining - 15
    segments.push(segmentMinutes)
    remaining -= segmentMinutes
  }

  if (remaining > 0) segments.push(remaining)
  return segments.map((durationMinutes, index) => ({
    durationMinutes,
    taskType: index === 0 ? 'Learning' : 'Practice',
  }))
}

function subjectCapMinutes(subject, globalCapMinutes) {
  const subjectHours = Number(subject.availableStudyHours)
  if (!Number.isFinite(subjectHours) || subjectHours <= 0) return globalCapMinutes
  return Math.min(globalCapMinutes, Math.floor(subjectHours * 60))
}

export function validateStudyPlanInputs(subjects, availableHoursPerDay, currentDate = new Date(), options = {}) {
  const issues = []
  const startDate = normalizeDate(options.startDate ?? currentDate)
  const dailyHours = Number(availableHoursPerDay)

  if (!startDate) issues.push({ code: 'invalid-current-date', message: 'The current study date is invalid. Check your device date.' })
  if (!Number.isFinite(dailyHours) || dailyHours <= 0) {
    issues.push({ code: 'invalid-daily-hours', message: 'Available study hours per day must be a number greater than zero.' })
  }
  if (!Array.isArray(subjects)) {
    issues.push({ code: 'invalid-subject-list', message: 'Subjects must be a list before a study plan can be generated.' })
    return issues
  }

  const seenSubjectIds = new Set()
  subjects.forEach((subject, subjectIndex) => {
    const subjectLabel = subject?.name?.trim() || `Subject ${subjectIndex + 1}`
    if (!subject || typeof subject !== 'object' || !subject.id || !subject.name?.trim()) {
      issues.push({ code: 'invalid-subject', subjectId: subject?.id, message: `${subjectLabel} needs a subject name and identifier before it can be scheduled.` })
      return
    }
    if (seenSubjectIds.has(subject.id)) {
      issues.push({ code: 'duplicate-subject-id', subjectId: subject.id, subject: subject.name, message: `${subject.name} shares a duplicate subject identifier and cannot be scheduled reliably.` })
      return
    }
    seenSubjectIds.add(subject.id)
    if (!Array.isArray(subject.topics)) {
      issues.push({ code: 'invalid-topics', subjectId: subject.id, subject: subject.name, message: `${subject.name} has an invalid topic list and was not scheduled.` })
      return
    }

    if (subject.examDate) {
      const examDate = normalizeDate(subject.examDate)
      if (!examDate) {
        issues.push({ code: 'invalid-exam-date', subjectId: subject.id, subject: subject.name, message: `${subject.name} has an invalid exam date. Use a real calendar date.` })
      } else if (startDate && examDate < startDate) {
        issues.push({ code: 'past-exam-date', subjectId: subject.id, subject: subject.name, message: `${subject.name}'s exam date has passed, so its remaining topics cannot be scheduled.` })
      }
    }

    const subjectHours = Number(subject.availableStudyHours)
    if (subject.availableStudyHours !== undefined && (!Number.isFinite(subjectHours) || subjectHours <= 0)) {
      issues.push({ code: 'invalid-subject-hours', subjectId: subject.id, subject: subject.name, message: `${subject.name} has invalid available hours; the daily study limit will be used instead.` })
    }
    if (!validDifficulties.has(String(subject.difficulty ?? 'medium').toLowerCase())) {
      issues.push({ code: 'invalid-subject-difficulty', subjectId: subject.id, subject: subject.name, message: `${subject.name} has an unknown difficulty; Medium weighting will be used.` })
    }
    if (!validPriorities.has(String(subject.priority ?? 'medium').toLowerCase())) {
      issues.push({ code: 'invalid-subject-priority', subjectId: subject.id, subject: subject.name, message: `${subject.name} has an unknown priority; Medium weighting will be used.` })
    }

    const seenTopicIds = new Set()
    subject.topics.forEach((topic, topicIndex) => {
      const topicLabel = topic?.name?.trim() || `Topic ${topicIndex + 1}`
      if (!topic || typeof topic !== 'object' || !topic.name?.trim()) {
        issues.push({ code: 'invalid-topic-name', subjectId: subject.id, subject: subject.name, message: `${subject.name}: ${topicLabel} needs a topic name and was not scheduled.` })
        return
      }
      if (!topic.id) {
        issues.push({ code: 'missing-topic-id', subjectId: subject.id, subject: subject.name, topic: topic.name, message: `${subject.name}: ${topic.name} has no stable identifier and was not scheduled.` })
        return
      }
      if (seenTopicIds.has(topic.id)) {
        issues.push({ code: 'duplicate-topic-id', subjectId: subject.id, subject: subject.name, topic: topic.name, message: `${subject.name}: ${topic.name} shares a duplicate topic identifier and was not scheduled.` })
        return
      }
      seenTopicIds.add(topic.id)
      const estimate = Number(topic.estimatedMinutes)
      if (!Number.isFinite(estimate) || estimate <= 0) {
        issues.push({ code: 'invalid-topic-estimate', subjectId: subject.id, subject: subject.name, topic: topic.name, message: `${subject.name}: ${topic.name} has no valid estimate; a 30-minute estimate will be used.` })
      }
      if (!validDifficulties.has(String(topic.difficulty ?? subject.difficulty ?? 'medium').toLowerCase())) {
        issues.push({ code: 'invalid-topic-difficulty', subjectId: subject.id, subject: subject.name, topic: topic.name, message: `${subject.name}: ${topic.name} has an unknown difficulty; Medium weighting will be used.` })
      }
    })
  })

  return issues
}

function completedRangesFor(taskGroupKey, completedTaskSegments, totalMinutes) {
  const ranges = completedTaskSegments
    .filter((segment) => segment.taskGroupKey === taskGroupKey)
    .map((segment) => {
      const start = Math.max(0, Math.min(totalMinutes, Math.floor(Number(segment.offsetMinutes))))
      const end = Math.max(start, Math.min(totalMinutes, start + Math.floor(Number(segment.durationMinutes))))
      return { start, end }
    })
    .filter((range) => range.end > range.start)
    .sort((first, second) => first.start - second.start)

  return ranges.reduce((merged, range) => {
    const previous = merged.at(-1)
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end)
    else merged.push({ ...range })
    return merged
  }, [])
}

function pendingRanges(totalMinutes, completedRanges) {
  const pending = []
  let cursor = 0
  completedRanges.forEach((range) => {
    if (range.start > cursor) pending.push({ offsetMinutes: cursor, durationMinutes: range.start - cursor })
    cursor = Math.max(cursor, range.end)
  })
  if (cursor < totalMinutes) pending.push({ offsetMinutes: cursor, durationMinutes: totalMinutes - cursor })
  return pending
}

function completedMinutes(completedRanges) {
  return completedRanges.reduce((total, range) => total + range.end - range.start, 0)
}

function compareWork(first, second) {
  const deadlineOrder = first.deadline.getTime() - second.deadline.getTime()
  if (deadlineOrder) return deadlineOrder
  const missedOrder = (second.missedPriority ?? 0) - (first.missedPriority ?? 0)
  if (missedOrder) return missedOrder
  const priorityOrder = (priorityRanks[second.subject.priority?.toLowerCase()] ?? 2)
    - (priorityRanks[first.subject.priority?.toLowerCase()] ?? 2)
  if (priorityOrder) return priorityOrder
  const difficultyOrder = (difficultyRanks[second.difficulty.toLowerCase()] ?? 2)
    - (difficultyRanks[first.difficulty.toLowerCase()] ?? 2)
  if (difficultyOrder) return difficultyOrder
  return first.subject.name.localeCompare(second.subject.name) || first.topic.localeCompare(second.topic)
}

function interleaveSubjects(events) {
  const remaining = [...events].sort(compareWork)
  const ordered = []
  let previousSubjectId = null

  while (remaining.length) {
    let nextIndex = remaining.findIndex((event) => event.subject.id !== previousSubjectId)
    if (nextIndex < 0) nextIndex = 0
    const [nextEvent] = remaining.splice(nextIndex, 1)
    ordered.push(nextEvent)
    previousSubjectId = nextEvent.subject.id
  }

  return ordered
}

function timeLabel(minutesAfterMidnight) {
  const hour24 = Math.floor(minutesAfterMidnight / 60) % 24
  const minute = minutesAfterMidnight % 60
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${String(minute).padStart(2, '0')} ${hour24 < 12 ? 'AM' : 'PM'}`
}

function scheduleDay(date, events) {
  const orderedEvents = interleaveSubjects(events)
  const scheduled = []
  let cursor = 9 * 60

  orderedEvents.forEach((event, index) => {
    const end = cursor + event.durationMinutes
    scheduled.push({
      id: `${event.taskKey}:${date}`,
      taskKey: event.taskKey,
      taskGroupKey: event.taskGroupKey ?? null,
      taskOffsetMinutes: event.taskOffsetMinutes ?? null,
      subjectId: event.subject.id,
      topicId: event.topicId ?? null,
      topicIds: event.topicIds ?? (event.topicId ? [event.topicId] : []),
      date,
      startTime: timeLabel(cursor),
      endTime: timeLabel(end),
      subject: event.subject.name,
      topic: event.topic,
      durationMinutes: event.durationMinutes,
      taskType: event.taskType,
    })
    cursor = end

    if (index < orderedEvents.length - 1) {
      scheduled.push({
        id: `break:${date}:${index}`,
        subjectId: null,
        date,
        startTime: timeLabel(cursor),
        endTime: timeLabel(cursor + breakMinutes),
        subject: 'Break',
        topic: 'Short break',
        durationMinutes: breakMinutes,
        taskType: 'Break',
      })
      cursor += breakMinutes
    }
  })

  return scheduled
}

export function generateStudyPlan(subjects, availableHoursPerDay, currentDate = new Date(), options = {}) {
  const today = normalizeDate(options.startDate ?? currentDate)
  const availableMinutesPerDay = Math.floor(Number(availableHoursPerDay) * 60)
  if (!today || !Array.isArray(subjects) || availableMinutesPerDay <= 0) return []
  const completedTaskKeys = new Set(options.completedTaskKeys ?? [])
  const completedTaskSegments = Array.isArray(options.completedTaskSegments) ? options.completedTaskSegments : []
  const completedMinutesByDate = options.completedMinutesByDate ?? {}
  const completedMinutesBySubjectAndDate = options.completedMinutesBySubjectAndDate ?? {}
  const missedTopicIds = new Set(options.missedTopicIds ?? [])

  function completedMinutesForDate(date) {
    const minutes = Number(completedMinutesByDate[dateKey(date)] ?? 0)
    return Number.isFinite(minutes) ? Math.max(0, minutes) : 0
  }

  function completedMinutesForSubject(subjectId, date) {
    const minutes = Number(completedMinutesBySubjectAndDate[`${subjectId}:${dateKey(date)}`] ?? 0)
    return Number.isFinite(minutes) ? Math.max(0, minutes) : 0
  }

  const horizon = addDays(today, planningHorizonDays)
  const fallbackDeadline = addDays(today, planningDaysWithoutExam - 1)
  const seenSubjectIds = new Set()
  const subjectPlans = subjects.flatMap((subject) => {
    if (!subject?.id || !subject.name || !Array.isArray(subject.topics) || seenSubjectIds.has(subject.id)) return []
    seenSubjectIds.add(subject.id)
    const examDate = subject.examDate ? normalizeDate(subject.examDate) : null
    if (subject.examDate && !examDate) return []
    if (examDate && examDate < today) return []

    const lastStudyDate = examDate
      ? new Date(Math.min(addDays(examDate, -1).getTime(), horizon.getTime()))
      : fallbackDeadline
    if (lastStudyDate < today) return []

    return [{
      subject,
      examDate,
      deadline: lastStudyDate,
      dailyCap: subjectCapMinutes(subject, availableMinutesPerDay),
    }]
  })

  const learningJobs = []
  const fixedRevisionJobs = []
  const floatingRevisionJobs = []

  subjectPlans.forEach((plan) => {
    const seenTopicIds = new Set()
    const validTopics = plan.subject.topics.filter((topic) => {
      if (!topic?.id || !topic.name?.trim() || seenTopicIds.has(topic.id)) return false
      seenTopicIds.add(topic.id)
      return true
    })
    const unfinishedTopics = validTopics.filter((topic) => !topic.completed)
    const markedTopics = validTopics.filter((topic) => (
      topic.completed && (topic.needsRevision || topic.markedForRevision || topic.revisionRequired)
    ))

    unfinishedTopics.forEach((topic) => {
      makeLearningSegments(topicStudyMinutes(topic, plan.subject)).forEach((segment, index) => {
        const taskGroupKey = `${plan.subject.id}:${topic.id ?? topic.name}:${segment.taskType}:${index}`
        if (completedTaskKeys.has(taskGroupKey)) return
        const ranges = completedRangesFor(taskGroupKey, completedTaskSegments, segment.durationMinutes)
        pendingRanges(segment.durationMinutes, ranges).forEach(({ offsetMinutes, durationMinutes }) => {
          learningJobs.push({
            taskKey: `${taskGroupKey}:offset:${offsetMinutes}`,
            taskGroupKey,
            taskOffsetMinutes: offsetMinutes,
            subject: plan.subject,
            topicId: topic.id ?? topic.name,
            deadline: plan.deadline,
            topic: topic.name,
            difficulty: String(topic.difficulty ?? plan.subject.difficulty ?? 'Medium').toLowerCase(),
            remainingMinutes: durationMinutes,
            taskType: segment.taskType,
            missedPriority: missedTopicIds.has(topic.id) ? 1 : 0,
          })
        })
      })
    })

    const revisionTopicNames = [
      ...unfinishedTopics.map((topic) => topic.name),
      ...markedTopics.map((topic) => topic.name),
    ]
    if (!revisionTopicNames.length) return

    const unfinishedEffort = unfinishedTopics.reduce((total, topic) => total + topicStudyMinutes(topic, plan.subject), 0)
    const markedEffort = markedTopics.reduce((total, topic) => total + topicStudyMinutes(topic, plan.subject) * 0.5, 0)
    const revisionMinutes = Math.min(45, Math.max(15, roundToFive((unfinishedEffort + markedEffort) * 0.2)))
    const revisionJob = {
      taskKey: `revision:${plan.subject.id}`,
      subject: plan.subject,
      topicIds: revisionTopicNames.map((name) => plan.subject.topics.find((topic) => topic.name === name)?.id).filter(Boolean),
      deadline: plan.deadline,
      topic: `Review: ${revisionTopicNames.join(', ')}`,
      difficulty: String(plan.subject.difficulty ?? 'Medium').toLowerCase(),
      remainingMinutes: Math.min(revisionMinutes, plan.dailyCap),
      taskType: 'Revision',
      missedPriority: plan.subject.topics.some((topic) => missedTopicIds.has(topic.id)) ? 1 : 0,
    }
    if (completedTaskKeys.has(revisionJob.taskKey)) return

    if (plan.examDate) {
      const revisionDate = addDays(plan.examDate, -1)
      if (revisionDate >= today && revisionDate <= horizon) {
        fixedRevisionJobs.push({ ...revisionJob, revisionDate, deadline: revisionDate })
      }
    } else {
      floatingRevisionJobs.push({ ...revisionJob, deadline: addDays(today, planningDaysWithoutExam * 2 - 1) })
    }
  })

  if (!learningJobs.length && !fixedRevisionJobs.length && !floatingRevisionJobs.length) return []

  fixedRevisionJobs.sort(compareWork)
  const reservedRevisions = new Map()
  const reservedMinutesByDate = new Map()
  const reservedMinutesBySubjectAndDate = new Map()

  fixedRevisionJobs.forEach((job) => {
    const revisionDate = dateKey(job.revisionDate)
    const reservedOnDate = reservedMinutesByDate.get(revisionDate) ?? 0
    const usedOnDate = completedMinutesForDate(job.revisionDate) + reservedOnDate
    const subjectDateKey = `${job.subject.id}:${revisionDate}`
    const reservedBySubject = reservedMinutesBySubjectAndDate.get(subjectDateKey) ?? 0
    const usedBySubject = completedMinutesForSubject(job.subject.id, job.revisionDate)
      + reservedBySubject
    const durationMinutes = Math.min(
      job.remainingMinutes,
      availableMinutesPerDay - usedOnDate,
      subjectCapMinutes(job.subject, availableMinutesPerDay) - usedBySubject,
    )
    if (durationMinutes <= 0) return

    const scheduledJob = { ...job, remainingMinutes: durationMinutes }
    const jobsForDate = reservedRevisions.get(revisionDate) ?? []
    jobsForDate.push(scheduledJob)
    reservedRevisions.set(revisionDate, jobsForDate)
    reservedMinutesByDate.set(revisionDate, reservedOnDate + durationMinutes)
    reservedMinutesBySubjectAndDate.set(subjectDateKey, reservedBySubject + durationMinutes)
  })

  const latestDates = [
    ...learningJobs.map((job) => job.deadline),
    ...[...reservedRevisions.keys()].map((date) => normalizeDate(date)),
    ...floatingRevisionJobs.map((job) => job.deadline),
  ]
  const finalDate = new Date(Math.max(today.getTime(), ...latestDates.map((date) => date.getTime())))
  const scheduledByDate = new Map()
  const dailyStudyMinutes = new Map(Object.entries(completedMinutesByDate).map(([date, minutes]) => [date, Math.max(0, Number(minutes) || 0)]))
  const subjectStudyMinutes = new Map(Object.entries(completedMinutesBySubjectAndDate).map(([key, minutes]) => [key, Math.max(0, Number(minutes) || 0)]))

  function addStudyEvent(date, job, durationMinutes) {
    const key = dateKey(date)
    const dayEvents = scheduledByDate.get(key) ?? []
    dayEvents.push({ ...job, durationMinutes })
    scheduledByDate.set(key, dayEvents)
    dailyStudyMinutes.set(key, (dailyStudyMinutes.get(key) ?? 0) + durationMinutes)
    const subjectDateKey = `${job.subject.id}:${key}`
    subjectStudyMinutes.set(subjectDateKey, (subjectStudyMinutes.get(subjectDateKey) ?? 0) + durationMinutes)
  }

  for (let date = new Date(today); date <= finalDate; date = addDays(date, 1)) {
    const key = dateKey(date)
    const reservedJobs = reservedRevisions.get(key) ?? []
    const reservedForDay = reservedMinutesByDate.get(key) ?? 0
    const remainingForDay = availableMinutesPerDay - completedMinutesForDate(date) - reservedForDay
    let usedForWork = 0
    let lastSubjectId = null

    while (usedForWork < remainingForDay) {
      const availableJobs = learningJobs.filter((job) => {
        if (job.remainingMinutes <= 0 || job.deadline < date) return false
        const subjectDateKey = `${job.subject.id}:${key}`
        const reservedForSubject = reservedMinutesBySubjectAndDate.get(subjectDateKey) ?? 0
        const usedBySubject = subjectStudyMinutes.get(subjectDateKey) ?? 0
        return usedBySubject < subjectCapMinutes(job.subject, availableMinutesPerDay) - reservedForSubject
      }).sort(compareWork)

      if (!availableJobs.length) break
      let job = availableJobs.find((item) => item.subject.id !== lastSubjectId) ?? availableJobs[0]
      const subjectDateKey = `${job.subject.id}:${key}`
      const reservedForSubject = reservedMinutesBySubjectAndDate.get(subjectDateKey) ?? 0
      const usedBySubject = subjectStudyMinutes.get(subjectDateKey) ?? 0
      const subjectAvailable = subjectCapMinutes(job.subject, availableMinutesPerDay) - reservedForSubject - usedBySubject
      const dayAvailable = remainingForDay - usedForWork
      const durationMinutes = Math.min(job.remainingMinutes, subjectAvailable, dayAvailable)
      if (durationMinutes <= 0) break

      addStudyEvent(date, job, durationMinutes)
      job.remainingMinutes -= durationMinutes
      job.taskOffsetMinutes = (job.taskOffsetMinutes ?? 0) + durationMinutes
      job.taskKey = `${job.taskGroupKey ?? job.taskKey.split(':offset:')[0]}:offset:${job.taskOffsetMinutes}`
      usedForWork += durationMinutes
      lastSubjectId = job.subject.id
    }

    reservedJobs.forEach((job) => addStudyEvent(date, job, job.remainingMinutes))
  }

  floatingRevisionJobs.sort(compareWork)
  for (let date = new Date(today); date <= finalDate; date = addDays(date, 1)) {
    const key = dateKey(date)
    let lastSubjectId = null

    while ((dailyStudyMinutes.get(key) ?? 0) < availableMinutesPerDay) {
      const availableJobs = floatingRevisionJobs.filter((job) => {
        if (job.remainingMinutes <= 0 || job.deadline < date) return false
        const subjectDateKey = `${job.subject.id}:${key}`
        return (subjectStudyMinutes.get(subjectDateKey) ?? 0) < subjectCapMinutes(job.subject, availableMinutesPerDay)
      }).sort(compareWork)
      if (!availableJobs.length) break

      const job = availableJobs.find((item) => item.subject.id !== lastSubjectId) ?? availableJobs[0]
      const subjectDateKey = `${job.subject.id}:${key}`
      const dayAvailable = availableMinutesPerDay - (dailyStudyMinutes.get(key) ?? 0)
      const subjectAvailable = subjectCapMinutes(job.subject, availableMinutesPerDay) - (subjectStudyMinutes.get(subjectDateKey) ?? 0)
      const durationMinutes = Math.min(job.remainingMinutes, dayAvailable, subjectAvailable)
      if (durationMinutes <= 0) break

      addStudyEvent(date, job, durationMinutes)
      job.remainingMinutes -= durationMinutes
      lastSubjectId = job.subject.id
    }
  }

  return [...scheduledByDate.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .flatMap(([date, events]) => scheduleDay(date, events))
}

export function generateStudyPlanReport(subjects, availableHoursPerDay, currentDate = new Date(), options = {}) {
  const schedule = generateStudyPlan(subjects, availableHoursPerDay, currentDate, options)
  const validationIssues = validateStudyPlanInputs(subjects, availableHoursPerDay, currentDate, options)
  const completedTaskKeys = new Set(options.completedTaskKeys ?? [])
  const completedTaskSegments = Array.isArray(options.completedTaskSegments) ? options.completedTaskSegments : []
  const scheduledMinutesByTopic = new Map()

  schedule.forEach((event) => {
    if (!event.topicId || !['Learning', 'Practice'].includes(event.taskType)) return
    scheduledMinutesByTopic.set(event.topicId, (scheduledMinutesByTopic.get(event.topicId) ?? 0) + event.durationMinutes)
  })

  const startDate = normalizeDate(options.startDate ?? currentDate)
  const validSubjectRecords = Array.isArray(subjects) ? subjects.filter((subject) => subject && typeof subject === 'object') : []
  const unscheduledTopics = validSubjectRecords.flatMap((subject) => {
    const examDate = subject.examDate ? normalizeDate(subject.examDate) : null
    const topics = Array.isArray(subject.topics) ? subject.topics : []
    return topics.flatMap((topic) => {
      if (topic.completed) return []
      const topicId = topic.id ?? topic.name
      const topicKeyPrefix = `${subject.id}:${topicId}:`
      const requiredMinutes = makeLearningSegments(topicStudyMinutes(topic, subject))
        .reduce((total, segment, index) => {
          const taskGroupKey = `${topicKeyPrefix}${segment.taskType}:${index}`
          if (completedTaskKeys.has(taskGroupKey)) return total
          const ranges = completedRangesFor(taskGroupKey, completedTaskSegments, segment.durationMinutes)
          return total + segment.durationMinutes - completedMinutes(ranges)
        }, 0)
      const plannedMinutes = scheduledMinutesByTopic.get(topicId) ?? 0
      if (plannedMinutes >= requiredMinutes) return []
      const remainingDays = examDate && startDate
        ? Math.max(0, Math.floor((examDate - startDate) / 86_400_000))
        : null
      return [{
        subjectId: subject.id,
        subject: subject.name,
        topicId,
        topic: topic.name,
        remainingMinutes: Math.max(0, requiredMinutes - plannedMinutes),
        examDate: subject.examDate ?? null,
        remainingDays,
      }]
    })
  })

  const unscheduledRevisions = validSubjectRecords.flatMap((subject) => {
    const examDate = subject.examDate ? normalizeDate(subject.examDate) : null
    if (!examDate || !startDate || completedTaskKeys.has(`revision:${subject.id}`)) return []
    const revisionDate = addDays(examDate, -1)
    if (revisionDate < startDate) return []

    const topics = Array.isArray(subject.topics) ? subject.topics : []
    const unfinishedTopics = topics.filter((topic) => !topic.completed)
    const markedTopics = topics.filter((topic) => topic.completed && (topic.needsRevision || topic.markedForRevision || topic.revisionRequired))
    if (!unfinishedTopics.length && !markedTopics.length) return []

    const unfinishedEffort = unfinishedTopics.reduce((total, topic) => total + topicStudyMinutes(topic, subject), 0)
    const markedEffort = markedTopics.reduce((total, topic) => total + topicStudyMinutes(topic, subject) * 0.5, 0)
    const requestedMinutes = Math.min(45, Math.max(15, roundToFive((unfinishedEffort + markedEffort) * 0.2)))
    const cappedMinutes = Math.min(requestedMinutes, subjectCapMinutes(subject, Math.floor(Number(availableHoursPerDay) * 60)))
    const plannedMinutes = schedule
      .filter((event) => event.subjectId === subject.id && event.date === dateKey(revisionDate) && event.taskType === 'Revision')
      .reduce((total, event) => total + event.durationMinutes, 0)
    if (plannedMinutes >= cappedMinutes) return []

    return [{
      subjectId: subject.id,
      subject: subject.name,
      topicId: `revision:${subject.id}`,
      topic: 'Revision before exam',
      remainingMinutes: cappedMinutes - plannedMinutes,
      examDate: subject.examDate,
      remainingDays: Math.max(0, Math.floor((examDate - startDate) / 86_400_000)),
      taskType: 'Revision',
    }]
  })

  return { schedule, unscheduledTopics: [...unscheduledTopics, ...unscheduledRevisions], validationIssues }
}