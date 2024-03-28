import { ReactContext } from 'shared/ReactTypes'

let prevContextValue: any = null
const prevContextValueStack: any[] = []

export function pushProvider<T>(context: ReactContext<T>, newValue: T) {
  prevContextValueStack.push(prevContextValue)

  prevContextValue = context.__currentValue
  context.__currentValue = newValue
}

export function popProvider<T>(context: ReactContext<T>) {
  context.__currentValue = prevContextValue

  prevContextValue = prevContextValueStack.pop()
}
