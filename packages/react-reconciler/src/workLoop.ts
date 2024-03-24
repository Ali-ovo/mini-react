import { scheduleMicroTask } from 'hostConfig'
import { beginWork } from './beginWork'
import {
  commitHookEffectListCreate,
  commitHookEffectListDestroy,
  commitHookEffectListUnmount,
  commitMutationEffects
} from './commitWork'
import { completeWork } from './completeWork'
import { FiberNode, FiberRootNode, PendingPassiveEffects, createWorkInProgress } from './fiber'
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags'
import {
  Lane,
  NoLane,
  SyncLane,
  getHighestPriorityLane,
  lanesToSchedulerPriority,
  markRootFinished,
  mergeLanes
} from './fiberLanes'
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue'
import { HostRoot } from './workTags'
import {
  unstable_scheduleCallback as scheduleCallback,
  unstable_NormalPriority as NormalPriority,
  unstable_shouldYield,
  unstable_cancelCallback
} from 'scheduler'
import { HookHasEffect, Passive } from './hookEffectTags'

let workInProgress: FiberNode | null = null
let workInProgressRootRenderLane: Lane = NoLane
let rootDoesHasPassiveEffects: boolean = false

type RootExitStatus = number
const RootInComplete = 1
const RootCompleted = 2
// TODO: error

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = NoLane
  root.finishedWork = null
  workInProgress = createWorkInProgress(root.current, {})
  workInProgressRootRenderLane = lane
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  const root = markUpdateFromFiberToRoot(fiber)

  markRootUpdated(root, lane)
  ensureRootIsScheduled(root)
}

function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes)
  const existingCallback = root.callbackNode
  if (updateLane === NoLane) {
    if (existingCallback !== null) {
      unstable_cancelCallback(existingCallback)
    }
    root.callbackNode = null
    root.callbackPriority = NoLane
    return
  }

  const curPriority = updateLane
  const prevPriority = root.callbackPriority

  if (curPriority === prevPriority) {
    return
  }

  if (existingCallback !== null) {
    unstable_cancelCallback(existingCallback)
  }

  let newCallbackNode = null

  if (updateLane === SyncLane) {
    // 同步优先级 用微任务
    // scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane))
    // @ts-ignore
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane))
    scheduleMicroTask(flushSyncCallbacks)
  } else {
    // 其他优先级 用宏任务
    const schedulerPriority = lanesToSchedulerPriority(updateLane)
    // @ts-ignore
    newCallbackNode = scheduleCallback(
      schedulerPriority,
      performConcurrentWorkOnRoot.bind(null, root)
    )
  }

  root.callbackNode = newCallbackNode
  root.callbackPriority = curPriority
}

function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane)
}

function markUpdateFromFiberToRoot(fiber: FiberNode) {
  let node = fiber
  let parent = node.return

  while (parent !== null) {
    node = parent
    parent = node.return
  }

  if (node.tag === HostRoot) {
    return node.stateNode
  }

  return null
}

function performConcurrentWorkOnRoot(root: FiberRootNode, didTimeout: boolean): any {
  const curCallback = root.callbackNode
  const didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects)

  if (didFlushPassiveEffect) {
    if (root.callbackNode !== curCallback) {
      return null
    }
  }

  const lane = getHighestPriorityLane(root.pendingLanes)
  const curCallbackNode = root.callbackNode

  if (lane === NoLane) {
    return null
  }

  const needSync = lane === SyncLane || didTimeout
  const exitStatus = renderRoot(root, lane, !needSync)

  ensureRootIsScheduled(root)

  if (exitStatus === RootInComplete) {
    if (root.callbackNode !== curCallbackNode) {
      return null
    }

    return performConcurrentWorkOnRoot.bind(null, root)
  }

  if (exitStatus === RootCompleted) {
    const finishedWork = root.current.alternate
    root.finishedWork = finishedWork
    root.finishedLane = lane
    workInProgressRootRenderLane = NoLane

    // dom update
    commitRoot(root)
  } else if (__DEV__) {
    console.warn('performSyncWorkOnRoot: 还未实现并发更新结束的状态')
  }
}

function performSyncWorkOnRoot(root: FiberRootNode) {
  const nextLane = getHighestPriorityLane(root.pendingLanes)
  if (nextLane !== SyncLane) {
    // 其他 SyncLane 低的优先级
    // NoLane
    ensureRootIsScheduled(root)
    return
  }

  const exitStatus = renderRoot(root, nextLane, false)

  if (exitStatus === RootCompleted) {
    const finishedWork = root.current.alternate
    root.finishedWork = finishedWork
    root.finishedLane = nextLane
    workInProgressRootRenderLane = NoLane

    // dom update
    commitRoot(root)
  } else if (__DEV__) {
    console.warn('performSyncWorkOnRoot: 还未实现同步更新结束的状态')
  }
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
  if (__DEV__) {
    console.log('renderRoot', root, lane, shouldTimeSlice ? '并发' : '同步')
  }

  if (workInProgressRootRenderLane !== lane) {
    // initialize
    prepareFreshStack(root, lane)
  }

  do {
    try {
      shouldTimeSlice ? workLoopConcurrent() : workLooSync()
      break
    } catch (e) {
      if (__DEV__) {
        console.warn('workLoop error', e)
      }
      workInProgress = null
    }
  } while (true)

  // 中断
  if (shouldTimeSlice && workInProgress !== null) {
    return RootInComplete
  }

  // 完成
  if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
    console.error('renderRoot: 结束时 workInProgress 不为空')
  }

  // TODO: error
  return RootCompleted
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork

  if (finishedWork === null) {
    return
  }

  if (__DEV__) {
    console.log('commitRoot', finishedWork)
  }

  const lane = root.finishedLane
  if (lane === NoLane && __DEV__) {
    console.warn('commitRoot: lane must not be a NoLane')
  }

  // reset
  root.finishedWork = null
  root.finishedLane = NoLane

  markRootFinished(root, lane)

  if (
    (finishedWork.flags & PassiveMask) !== NoFlags ||
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags
  ) {
    if (!rootDoesHasPassiveEffects) {
      rootDoesHasPassiveEffects = true

      // 调度副作用
      scheduleCallback(NormalPriority, () => {
        flushPassiveEffects(root.pendingPassiveEffects)
        return
      })
    }
  }

  const subtreeHasEffect = (finishedWork.subtreeFlags & MutationMask) !== NoFlags

  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags

  if (subtreeHasEffect || rootHasEffect) {
    // before mutation
    // mutation
    commitMutationEffects(finishedWork, root)

    root.current = finishedWork

    // layout
  } else {
    root.current = finishedWork
  }

  rootDoesHasPassiveEffects = false
  ensureRootIsScheduled(root)
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
  let didFlushPassiveEffect = false
  pendingPassiveEffects.unmount.forEach(effect => {
    didFlushPassiveEffect = true
    commitHookEffectListUnmount(Passive, effect)
  })

  pendingPassiveEffects.unmount = []

  pendingPassiveEffects.update.forEach(effect => {
    didFlushPassiveEffect = true
    commitHookEffectListDestroy(Passive | HookHasEffect, effect)
  })

  pendingPassiveEffects.update.forEach(effect => {
    didFlushPassiveEffect = true
    commitHookEffectListCreate(Passive | HookHasEffect, effect)
  })
  pendingPassiveEffects.update = []

  flushSyncCallbacks()

  return didFlushPassiveEffect
}

function workLooSync() {
  while (workInProgress !== null) {
    preformUnitOfWork(workInProgress)
  }
}

function workLoopConcurrent() {
  while (workInProgress !== null && !unstable_shouldYield()) {
    preformUnitOfWork(workInProgress)
  }
}

function preformUnitOfWork(fiber: FiberNode) {
  const next = beginWork(fiber, workInProgressRootRenderLane)

  fiber.memoizedProps = fiber.pendingProps

  if (next === null) {
    completeUnitOfWork(fiber)
  } else {
    workInProgress = next
  }
}

function completeUnitOfWork(fiber: FiberNode) {
  let node: FiberNode | null = fiber

  do {
    completeWork(node)

    const sibling = node.sibling

    if (sibling != null) {
      workInProgress = sibling
      return
    }

    node = node.return
    workInProgress = node
  } while (node != null)
}
