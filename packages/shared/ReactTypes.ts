/*
 * @Description:react types
 * @Author: Ali
 * @Date: 2024-03-06 16:56:47
 * @LastEditTime: 2024-03-30 15:14:42
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

export type Usable<T> = Thenable<T> | ReactContext<T>

export interface Wakeable<Result = any> {
  then(onFulfill: () => Result, onReject: () => Result): void | Wakeable<Result>
}

interface ThenableImpl<T, Result, Err> {
  then(onFulfill: (value: T) => Result, onReject: (error: Err) => Result): void | Wakeable<Result>
}

interface UntrackedThenable<T, Result, Err> extends ThenableImpl<T, Result, Err> {
  status?: void
}

export interface PendingThenable<T, Result, Err> extends ThenableImpl<T, Result, Err> {
  status: 'pending'
}

export interface FulfilledThenable<T, Result, Err> extends ThenableImpl<T, Result, Err> {
  status: 'fulfilled'
  value: T
}

export interface RejectedThenable<T, Result, Err> extends ThenableImpl<T, Result, Err> {
  status: 'rejected'
  reason: Err
}

export type Thenable<T, Result = void, Err = any> =
  | UntrackedThenable<T, Result, Err>
  | PendingThenable<T, Result, Err>
  | FulfilledThenable<T, Result, Err>
  | RejectedThenable<T, Result, Err>
