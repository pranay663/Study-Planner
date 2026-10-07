import { spawn } from 'node:child_process'
import process from 'node:process'

const node = process.execPath
const children = [
  spawn(node, ['--env-file-if-exists=.env', '--watch', 'server/index.js'], { stdio: 'inherit' }),
  spawn(node, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], { stdio: 'inherit' }),
]

let stopping = false

function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  children.forEach((child) => {
    if (child.exitCode === null) child.kill()
  })
  process.exitCode = exitCode
}

children.forEach((child) => {
  child.on('error', (error) => {
    console.error(`Unable to start a development process: ${error.message}`)
    stop(1)
  })
  child.on('exit', (code) => {
    if (!stopping && code !== 0) stop(code ?? 1)
  })
})

process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))