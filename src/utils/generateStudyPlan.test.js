import assert from 'node:assert/strict'
import test from 'node:test'
import { generateStudyPlan, generateStudyPlanReport } from './generateStudyPlan.js'

const today = '2026-10-07'

function subject(overrides = {}) {
  return {
    id: 'subject-1',
    name: 'Physics',
    examDate: '2026-10-20',
    difficulty: 'Medium',
    priority: 'Medium',
    availableStudyHours: 8,
    topics: [{ id: 'topic-1', name: 'Motion', difficulty: 'Medium', estimatedMinutes: 45, completed: false }],
    ...overrides,
  }
}

function studyEvents(schedule) {
  return schedule.filter((event) => event.taskType !== 'Break')
}

function minutesAfterMidnight(value) {
  const [time, period] = value.split(' ')
  let [hour, minute] = time.split(':').map(Number)
  if (period === 'PM' && hour !== 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0
  return hour * 60 + minute
}

test('schedules work within each day cap and inserts breaks between sessions', () => {
  const schedule = generateStudyPlan([
    subject({ topics: Array.from({ length: 8 }, (_, index) => ({ id: `p-${index}`, name: `Topic ${index}`, difficulty: 'Hard', estimatedMinutes: 60, completed: false })) }),
  ], 1, today)
  const dates = [...new Set(schedule.map((event) => event.date))]

  for (const date of dates) {
    const events = schedule.filter((event) => event.date === date)
    const studyMinutes = events.filter((event) => event.taskType !== 'Break').reduce((total, event) => total + event.durationMinutes, 0)
    assert.ok(studyMinutes <= 60)
    assert.equal(events.filter((event) => event.taskType === 'Break').length, Math.max(0, studyEvents(events).length - 1))
  }
})

test('keeps completed topics out unless they are marked for revision', () => {
  const schedule = generateStudyPlan([
    subject({ topics: [
      { id: 'done', name: 'Finished chapter', difficulty: 'Easy', estimatedMinutes: 30, completed: true },
      { id: 'todo', name: 'Open chapter', difficulty: 'Medium', estimatedMinutes: 30, completed: false },
    ] }),
  ], 3, today)
  assert.ok(!schedule.some((event) => event.topic.includes('Finished chapter')))

  const revisionSchedule = generateStudyPlan([
    subject({ topics: [{ id: 'done', name: 'Finished chapter', difficulty: 'Easy', estimatedMinutes: 30, completed: true, needsRevision: true }] }),
  ], 3, today)
  assert.ok(revisionSchedule.some((event) => event.taskType === 'Revision' && event.topic.includes('Finished chapter')))
})

test('adds a revision session before the exam date', () => {
  const schedule = generateStudyPlan([subject()], 3, today)
  const revision = studyEvents(schedule).find((event) => event.taskType === 'Revision')
  assert.ok(revision)
  assert.ok(revision.date < '2026-10-20')
})

test('hard topics and high-priority subjects receive more study time', () => {
  const easyLow = generateStudyPlan([
    subject({ priority: 'Low', topics: [{ id: 'topic', name: 'Topic', difficulty: 'Easy', estimatedMinutes: 40, completed: false }] }),
  ], 8, today)
  const hardHigh = generateStudyPlan([
    subject({ priority: 'High', topics: [{ id: 'topic', name: 'Topic', difficulty: 'Hard', estimatedMinutes: 40, completed: false }] }),
  ], 8, today)
  const easyMinutes = studyEvents(easyLow).filter((event) => event.taskType !== 'Revision').reduce((total, event) => total + event.durationMinutes, 0)
  const hardMinutes = studyEvents(hardHigh).filter((event) => event.taskType !== 'Revision').reduce((total, event) => total + event.durationMinutes, 0)
  assert.ok(hardMinutes > easyMinutes)
})

test('rotates subjects when other subjects have work available', () => {
  const first = subject({ id: 'physics', name: 'Physics', topics: [{ id: 'p', name: 'Motion', difficulty: 'Medium', estimatedMinutes: 30, completed: false }] })
  const second = subject({ id: 'history', name: 'History', priority: 'High', topics: [{ id: 'h', name: 'Revolutions', difficulty: 'Medium', estimatedMinutes: 30, completed: false }] })
  const events = studyEvents(generateStudyPlan([first, second], 2, today)).filter((event) => event.date === today)
  assert.notEqual(events[0].subject, events[1].subject)
})

test('returns stable session identities and complete calendar fields', () => {
  const subjects = [subject()]
  const firstPlan = studyEvents(generateStudyPlan(subjects, 2, today))
  const secondPlan = studyEvents(generateStudyPlan(subjects, 2, today))

  assert.deepEqual(firstPlan.map((event) => event.id), secondPlan.map((event) => event.id))
  assert.ok(firstPlan.every((event) => event.subjectId === 'subject-1'))
  assert.ok(firstPlan.every((event) => event.date && event.startTime && event.endTime && event.durationMinutes > 0))
  assert.ok(firstPlan.every((event) => ['Learning', 'Practice', 'Revision'].includes(event.taskType)))
})

test('starts adaptive schedules on the requested date and prioritizes missed topics', () => {
  const physics = subject({
    topics: [
      { id: 'topic-1', name: 'New topic', difficulty: 'Medium', estimatedMinutes: 30, completed: false },
      { id: 'topic-2', name: 'Missed topic', difficulty: 'Medium', estimatedMinutes: 30, completed: false },
    ],
  })
  const schedule = generateStudyPlan([physics], 0.5, today, {
    startDate: '2026-10-08',
    missedTopicIds: ['topic-2'],
  }).filter((event) => event.taskType !== 'Break')

  assert.equal(schedule[0].date, '2026-10-08')
  assert.equal(schedule[0].topic, 'Missed topic')
})

test('does not schedule completed segments again after regeneration', () => {
  const physics = subject({ topics: [
    { id: 'topic-1', name: 'Finished session', difficulty: 'Medium', estimatedMinutes: 30, completed: false },
    { id: 'topic-2', name: 'Remaining topic', difficulty: 'Medium', estimatedMinutes: 30, completed: false },
  ] })
  const schedule = generateStudyPlan([physics], 1, today, {
    completedTaskKeys: ['subject-1:topic-1:Learning:0'],
  })

  assert.ok(!schedule.some((event) => event.topic === 'Finished session'))
  assert.ok(schedule.some((event) => event.topic === 'Remaining topic'))
})

test('preserves the unfinished portion of a session split across days', () => {
  const physics = subject({
    availableStudyHours: 0.25,
    topics: [{ id: 'split-topic', name: 'Split topic', difficulty: 'Easy', estimatedMinutes: 45, completed: false }],
  })
  const initialSchedule = generateStudyPlan([physics], 0.25, today)
    .filter((event) => event.topic === 'Split topic' && event.taskType !== 'Break')
  assert.equal(initialSchedule[0].durationMinutes, 15)

  const regenerated = generateStudyPlan([physics], 0.25, today, {
    startDate: '2026-10-08',
    completedTaskSegments: [{
      taskGroupKey: initialSchedule[0].taskGroupKey,
      offsetMinutes: initialSchedule[0].taskOffsetMinutes,
      durationMinutes: initialSchedule[0].durationMinutes,
    }],
  }).filter((event) => event.topic === 'Split topic' && event.taskType !== 'Break')

  assert.equal(regenerated.reduce((total, event) => total + event.durationMinutes, 0), 30)
  assert.ok(regenerated.every((event) => event.date >= '2026-10-08'))
})

test('completed study time still consumes the daily and subject capacity', () => {
  const physics = subject({
    availableStudyHours: 0.25,
    topics: [{ id: 'split-topic', name: 'Split topic', difficulty: 'Easy', estimatedMinutes: 30, completed: false }],
  })
  const initial = generateStudyPlan([physics], 0.25, today)
    .find((event) => event.topic === 'Split topic' && event.taskType !== 'Break')
  const regenerated = generateStudyPlan([physics], 0.25, today, {
    completedTaskSegments: [{
      taskGroupKey: initial.taskGroupKey,
      offsetMinutes: initial.taskOffsetMinutes,
      durationMinutes: initial.durationMinutes,
    }],
    completedMinutesByDate: { [today]: initial.durationMinutes },
    completedMinutesBySubjectAndDate: { [`subject-1:${today}`]: initial.durationMinutes },
  }).filter((event) => event.topic === 'Split topic' && event.taskType !== 'Break')

  assert.ok(regenerated.every((event) => event.date > today))
  assert.equal(regenerated.reduce((total, event) => total + event.durationMinutes, 0), 15)
})

test('reports impossible workloads instead of silently claiming a complete plan', () => {
  const overloaded = subject({
    examDate: '2026-10-09',
    availableStudyHours: 0.5,
    topics: [{ id: 'large-topic', name: 'Large topic', difficulty: 'Hard', estimatedMinutes: 240, completed: false }],
  })
  const result = generateStudyPlanReport([overloaded], 0.5, today, { startDate: today })

  assert.ok(result.unscheduledTopics.some((topic) => topic.topic === 'Large topic'))
  assert.equal(result.unscheduledTopics[0].remainingDays, 2)
  for (const date of new Set(result.schedule.map((event) => event.date))) {
    const dailyMinutes = result.schedule
      .filter((event) => event.date === date && event.taskType !== 'Break')
      .reduce((total, event) => total + event.durationMinutes, 0)
    assert.ok(dailyMinutes <= 30)
  }
})

test('does not recreate a completed pre-exam revision session', () => {
  const biology = subject({
    examDate: '2026-10-10',
    topics: [{ id: 'genetics', name: 'Genetics', difficulty: 'Medium', estimatedMinutes: 30, completed: true, needsRevision: true }],
  })
  const report = generateStudyPlanReport([biology], 2, today, {
    startDate: '2026-10-08',
    completedTaskKeys: ['revision:subject-1'],
  })

  assert.ok(!report.schedule.some((event) => event.taskType === 'Revision'))
  assert.ok(!report.unscheduledTopics.some((topic) => topic.taskType === 'Revision'))
})

test('respects each subject cap and creates non-overlapping timed sessions', () => {
  const subjects = [
    subject({ id: 'physics', name: 'Physics', availableStudyHours: 0.5, topics: [{ id: 'motion', name: 'Motion', difficulty: 'Easy', estimatedMinutes: 90, completed: false }] }),
    subject({ id: 'history', name: 'History', availableStudyHours: 0.5, priority: 'High', topics: [{ id: 'eras', name: 'Modern eras', difficulty: 'Medium', estimatedMinutes: 90, completed: false }] }),
  ]
  const schedule = generateStudyPlan(subjects, 2, today)
  const dates = [...new Set(schedule.map((event) => event.date))]

  for (const date of dates) {
    const dayEvents = schedule.filter((event) => event.date === date)
    for (let index = 1; index < dayEvents.length; index += 1) {
      assert.ok(minutesAfterMidnight(dayEvents[index - 1].endTime) <= minutesAfterMidnight(dayEvents[index].startTime))
    }
    for (const item of subjects) {
      const subjectMinutes = studyEvents(dayEvents).filter((event) => event.subjectId === item.id).reduce((total, event) => total + event.durationMinutes, 0)
      assert.ok(subjectMinutes <= 30)
    }
  }
})

test('reports revision that cannot fit when several exams share the same revision day', () => {
  const subjects = ['Biology', 'Physics', 'History'].map((name, index) => subject({
    id: `subject-${index}`,
    name,
    examDate: '2026-10-08',
    availableStudyHours: 0.5,
    topics: [{ id: `topic-${index}`, name: `${name} chapter`, difficulty: 'Medium', estimatedMinutes: 30, completed: false }],
  }))
  const report = generateStudyPlanReport(subjects, 0.5, today)
  const revisionDaySessions = report.schedule.filter((event) => event.date === '2026-10-07' && event.taskType === 'Revision')

  assert.ok(revisionDaySessions.reduce((total, event) => total + event.durationMinutes, 0) <= 30)
  assert.ok(report.unscheduledTopics.some((topic) => topic.taskType === 'Revision'))
})

test('never schedules learning on or after an exam that is today, tomorrow, or past', () => {
  const todayExam = subject({ examDate: '2026-10-07' })
  const tomorrowExam = subject({ examDate: '2026-10-08' })
  const pastExam = subject({ examDate: '2026-10-06' })

  for (const candidate of [todayExam, tomorrowExam, pastExam]) {
    const report = generateStudyPlanReport([candidate], 2, today, { startDate: today })
    assert.ok(report.schedule.every((event) => event.date < candidate.examDate))
    if (candidate !== tomorrowExam) {
      assert.ok(report.unscheduledTopics.some((topic) => topic.topic === 'Motion'), `Missing unscheduled topic for exam ${candidate.examDate}`)
    }
  }

  const tomorrowStart = generateStudyPlanReport([tomorrowExam], 2, today, { startDate: '2026-10-08' })
  assert.ok(tomorrowStart.schedule.length === 0)
  assert.ok(tomorrowStart.unscheduledTopics.some((topic) => topic.remainingDays === 0))
})

test('surfaces invalid calendar dates, hours, and topic estimates', () => {
  const invalid = subject({
    examDate: '2026-02-30',
    topics: [{ id: 'bad-estimate', name: 'Bad estimate', difficulty: 'Easy', estimatedMinutes: 0, completed: false }],
  })
  const report = generateStudyPlanReport([invalid], 0, today)
  const issueCodes = report.validationIssues.map((issue) => issue.code)

  assert.ok(issueCodes.includes('invalid-exam-date'))
  assert.ok(issueCodes.includes('invalid-daily-hours'))
  assert.ok(issueCodes.includes('invalid-topic-estimate'))
})

test('rejects duplicate and missing identities rather than colliding scheduled work', () => {
  const malformed = subject({ topics: [
    { id: 'same-id', name: 'First chapter', difficulty: 'Easy', estimatedMinutes: 30, completed: false },
    { id: 'same-id', name: 'Second chapter', difficulty: 'Easy', estimatedMinutes: 30, completed: false },
    { name: 'No stable id', difficulty: 'Easy', estimatedMinutes: 30, completed: false },
  ] })
  const report = generateStudyPlanReport([malformed], 2, today)
  const issueCodes = report.validationIssues.map((issue) => issue.code)

  assert.ok(issueCodes.includes('duplicate-topic-id'))
  assert.ok(issueCodes.includes('missing-topic-id'))
  assert.ok(report.schedule.filter((event) => ['Learning', 'Practice'].includes(event.taskType)).every((event) => event.topic === 'First chapter'))
})

test('rejects dates that roll over to another calendar month', () => {
  const malformedDate = subject({ examDate: '2026-02-30' })
  const report = generateStudyPlanReport([malformedDate], 2, today)

  assert.ok(report.validationIssues.some((issue) => issue.code === 'invalid-exam-date'))
  assert.ok(!report.schedule.some((event) => event.subject === malformedDate.name))
})