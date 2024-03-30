/*
 * @Description: fiber unwind
 * @Author: Ali
 * @Date: 2024-03-30 16:04:00
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-30 16:47:59
 */

import { FiberNode } from './fiber'
import { popProvider } from './fiberContext'
import { DidCapture, NoFlags, ShouldCapture } from './fiberFlags'
import { popSuspenseHandler } from './suspenseContext'
import { ContextProvider, HostRoot, SuspenseComponent } from './workTags'

export function unwindWork(wip: FiberNode) {
  const flags = wip.flags
  switch (wip.tag) {
    case SuspenseComponent:
      popSuspenseHandler()
      if ((flags & ShouldCapture) !== NoFlags && (flags & DidCapture) === NoFlags) {
        wip.flags = (flags & ~ShouldCapture) | DidCapture
        return wip
      }
      return null

    case ContextProvider:
      const context = wip.type._context
      popProvider(context)
      return null
    default:
      return null
  }
}
