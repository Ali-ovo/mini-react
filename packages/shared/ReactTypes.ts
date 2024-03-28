/*
 * @Description:react types
 * @Author: Ali
 * @Date: 2024-03-06 16:56:47
 * @LastEditTime: 2024-03-28 14:57:43
 */

export type Type = any
export type Key = any
export type Ref = { current: any } | ((instance: any) => void)
export type Props = any
export type ElementType = any

export interface ReactElementType {
  $$typeof: symbol | number
  type: ElementType
  key: Key
  ref: Ref | null
  props: Props
  __mark: string
}

export type Action<State> = State | ((prevState: State) => State)

export type ReactContext<T> = {
  $$typeof: symbol | number
  Provider: ReactProviderType<T> | null
  __currentValue: T
}

export type ReactProviderType<T> = {
  $$typeof: symbol | number
  _context: ReactContext<T>
}
