// Hash routes (#/report, #/admin) work on GitHub Pages without any server config.
import { useEffect, useState } from 'react'

export type Route = 'report' | 'admin'

function parse(hash: string): Route {
  return hash.replace(/^#\/?/, '').split(/[/?]/)[0] === 'admin' ? 'admin' : 'report'
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(location.hash))
  useEffect(() => {
    const on = () => setRoute(parse(location.hash))
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return route
}

export const href = (r: Route) => `#/${r}`
