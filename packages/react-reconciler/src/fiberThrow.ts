/*
 * @Description: fiber throw
 * @Author: Ali
 * @Date: 2024-03-30 15:44:27
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-30 17:14:10
 */

import { Wakeable } from 'shared/ReactTypes'
import { FiberRootNode } from './fiber'
import { Lane, markRootPinged } from './fiberLanes'
import { ensureRootIsScheduled, markRootUpdated } from './workLoop'
import { getSuspenseHandler } from './suspenseContext'
import { ShouldCapture } from './fiberFlags'

function attachPingListener(root: FiberRootNode, wakeable: Wakeable<any>, lane: Lane) {
  let pingCache = root.pingCache
  let threadIDs: Set<Lane> | undefined

  // WeakMap{ wakeable: Set[lane1, lane2, ...]}
  if (pingCache === null) {
    threadIDs = new Set<Lane>()
    pingCache = root.pingCache = new WeakMap<Wakeable<any>, Set<Lane>>()
    pingCache.set(wakeable, threadIDs)
  } else {
    threadIDs = pingCache.get(wakeable)
    if (threadIDs === undefined) {
      threadIDs = new Set<Lane>()
      pingCache.set(wakeable, threadIDs)
    }
  }

  function ping() {
    if (pingCache !== null) {
      pingCache.delete(wakeable)
    }
    markRootPinged(root, lane)
    markRootUpdated(root, lane)
    ensureRootIsScheduled(root)
  }

  if (!threadIDs.has(lane)) {
    // 第一次进入
    threadIDs.add(lane)

    wakeable.then(ping, ping)
  }
}

export function throwException(root: FiberRootNode, value: any, lane: Lane) {
  if (value !== null && typeof value === 'object' && typeof value.then === 'function') {
    const weakable: Wakeable<any> = value

    const suspenseBoundary = getSuspenseHandler()
    if (suspenseBoundary) {
      suspenseBoundary.flags |= ShouldCapture
    }
    attachPingListener(root, weakable, lane)
  }
}
