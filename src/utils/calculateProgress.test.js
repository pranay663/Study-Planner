import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateProgress } from './calculateProgress.js'

const currentDate = new Date(2026, 9, 7)

test('calculates topic totals, per-subject progress, and study hour totals', () => {
  const result = calculateProgress({
    currentDate,
    subjects: [
      { id: 'math', name: 'Mathematics', topics: [{ completed: true }, { completed: false }] },
      { id: 'history', name: 'History', topics: [{ completed: true }] },
    ],
    studySchedule: [
      { date: '2026-10-07', durationMinutes: 45, taskType: 'Learning', completed: true },
      { date: '2026-10-07', durationMinutes: 10, taskType: 'Break', completed: false },
      { date: '2026-10-08', durationMinutes: 60, taskType: 'Revision', completed: false },
    ],
  })

  assert.equal(result.totalTopics, 3)
  assert.equal(result.completedTopics, 2)
  assert.equal(result.remainingTopics, 1)
  assert.equal(result.overallPercentage, 67)
  assert.deepEqual(result.subjectProgress.map((subject) => subject.percentage), [50, 100])
  assert.equal(result.plannedStudyMinutes, 105)
  assert.equal(result.completedStudyMinutes, 45)
})

test('calculates today completion from dashboard tasks and scheduled sessions', () => {
  const result = calculateProgress({
    currentDate,
    dailyTasks: [{ done: true }, { done: false }],
    studySchedule: [
      { date: '2026-10-07', durationMinutes: 30, taskType: 'Learning', completed: true },
      { date: '2026-10-07', durationMinutes: 30, taskType: 'Practice', completed: false },
      { date: '2026-10-08', durationMinutes: 30, taskType: 'Learning', completed: true },
    ],
  })

  assert.equal(result.todayCompletedTasks, 2)
  assert.equal(result.todayTotalTasks, 4)
  assert.equal(result.todayCompletionRate, 50)
  assert.equal(result.weeklyActivity.length, 7)
  assert.equal(result.weeklyActivity[0].completedMinutes, 30)
  assert.equal(result.weeklyActivity[1].plannedMinutes, 30)
})

test('returns safe zero values for an empty study plan', () => {
  const result = calculateProgress({ subjects: [], studySchedule: [], dailyTasks: [], currentDate })

  assert.equal(result.overallPercentage, 0)
  assert.equal(result.todayCompletionRate, 0)
  assert.equal(result.remainingTopics, 0)
  assert.equal(result.plannedStudyMinutes, 0)
  assert.equal(result.weeklyActivity.length, 7)
})

test('keeps completed hours and missed tasks in history after schedule regeneration', () => {
  const result = calculateProgress({
    currentDate,
    calendarHistory: [
      { id: 'done-before-regeneration', date: '2026-10-07', durationMinutes: 45, taskType: 'Learning', completed: true },
      { id: 'missed-before-regeneration', date: '2026-10-07', durationMinutes: 30, taskType: 'Practice', missed: true },
    ],
    studySchedule: [{ id: 'tomorrow', date: '2026-10-08', durationMinutes: 60, taskType: 'Learning', completed: false }],
  })

  assert.equal(result.completedStudyMinutes, 45)
  assert.equal(result.plannedStudyMinutes, 135)
  assert.equal(result.todayCompletedTasks, 1)
  assert.equal(result.todayTotalTasks, 2)
})