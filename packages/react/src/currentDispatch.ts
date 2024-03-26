import { Action } from 'shared/ReactTypes'

export interface Dispatcher {
  useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>]
  useEffect: (callback: () => void | void, deps: any[] | null) => void
  useTransition: () => [boolean, (callback: () => void) => void]
}

export type Dispatch<State> = (action: Action<State>) => void

const currentDispatcher: { current: Dispatcher | null } = {
  current: null
}

export const resolveDispatcher = (): Dispatcher => {
  const dispatcher = currentDispatcher.current

  if (dispatcher === null) {
    throw new Error('hook error')
  }

  return dispatcher
}

export default currentDispatcher
