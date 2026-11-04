// Chooses the store: live GitHub data if this browser has a saved token, otherwise the demo.
import { config } from '../config'
import { GitHubApi } from './githubApi'
import { GitHubStore } from './githubStore'
import { LocalStore } from './localStore'
import type { TicketStore } from './store'

const TOKEN_KEY = 'cylinder-tracker:github-token'

export function savedToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function makeStore(): TicketStore {
  const token = savedToken()
  return token ? new GitHubStore(new GitHubApi(token, config.dataRepo.owner, config.dataRepo.name)) : new LocalStore()
}

/** Checks the token against the data repo, then saves it. Throws with a readable message if it won't work. */
export async function connect(token: string): Promise<void> {
  const api = new GitHubApi(token.trim(), config.dataRepo.owner, config.dataRepo.name)
  const repo = await api.checkRepo()
  if (!repo.private) throw new Error(`${config.dataRepo.owner}/${config.dataRepo.name} is public. Make it private before storing names and emails in it.`)
  await api.listIssues() // proves Issues read access
  localStorage.setItem(TOKEN_KEY, token.trim())
}

export function disconnect() {
  try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}
