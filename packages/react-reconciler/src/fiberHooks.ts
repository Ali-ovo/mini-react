/*
 * @Description: fiber hooks
 * @Author: Ali
 * @Date: 2024-03-15 15:24:15
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-15 15:29:25
 */

import { FiberNode } from './fiber'

export function renderWithHooks(workInProgress: FiberNode) {
  const Component = workInProgress.type
  const props = workInProgress.pendingProps
  const children = Component(props)

  return children
}
