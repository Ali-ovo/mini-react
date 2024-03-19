/*
 * @Description:react types
 * @Author: Ali
 * @Date: 2024-03-06 16:56:47
 * @LastEditTime: 2024-03-19 13:36:03
 */

export type Type = any
export type Key = any
export type Ref = any
export type Props = any
export type ElementType = any

export interface ReactElementType {
  $$typeof: symbol | number
  type: ElementType
  key: Key
  ref: Ref
  props: Props
  __mark: string
}

export type Action<State> = State | ((prevState: State) => State)
