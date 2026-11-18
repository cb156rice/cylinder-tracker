import { getSettings, normalize, setSettings, type Settings } from '../lib/directory'
import { useStore } from '../store/hooks'

/**
 * Saves settings: shows them right away, writes them to the store, and puts them back if the write fails
 * (the store's own error bar says why).
 */
export function useSaveSettings() {
  const store = useStore()
  async function save(next: Settings): Promise<boolean> {
    const before = getSettings()
    setSettings(normalize(next))
    try {
      await store.saveSettings(normalize(next))
      return true
    } catch {
      setSettings(before)
      return false
    }
  }
  return { save }
}
