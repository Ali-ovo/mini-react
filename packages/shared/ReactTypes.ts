/*
 * @Description:react types
 * @Author: Ali
 * @Date: 2024-03-06 16:56:47
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-06 16:59:02
 */

export type Type = any
export type Key = any
export type Ref = any
export type Props = any
export type ElementType = any

export interface ReactElement {
  $$typeof: symbol | number
  type: ElementType
  key: Key
  ref: Ref
  props: Props
  __mark: string
}
