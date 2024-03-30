/*
 * @Description: suspense context
 * @Author: Ali
 * @Date: 2024-03-30 15:57:59
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-30 16:48:17
 */

import { FiberNode } from './fiber'

const suspenseHandlerStack: FiberNode[] = []

export function getSuspenseHandler() {
  return suspenseHandlerStack[suspenseHandlerStack.length - 1]
}

export function pushSuspenseHandler(handler: FiberNode) {
  suspenseHandlerStack.push(handler)
}

export function popSuspenseHandler() {
  suspenseHandlerStack.pop()
}
