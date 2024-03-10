/*
 * @Description:react types
 * @Author: Ali
 * @Date: 2024-03-06 16:56:47
 * @LastEditors: ali ali_ovo@qq.com
 * @LastEditTime: 2024-03-10 18:37:01
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
