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
  markRootFinished,
  mergeLanes
} from './fiberLanes'
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue'
import { HostRoot } from './workTags'
import {
  unstable_scheduleCallback as scheduleCallback,
  unstable_NormalPriority as NormalPriority
} from 'scheduler'
import { HookHasEffect, Passive } from './hookEffectTags'

let workInProgress: FiberNode | null = null

let workInProgressRootRenderLane: Lane = NoLane

let rootDoesHasPassiveEffects: boolean = false

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  workInProgress = createWorkInProgress(root.current, {})
  workInProgressRootRenderLane = lane
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  const root = markUpdateFromFiberToRoot(fiber)

  markRootUpdated(root, lane)
  ensureRootIsScheduler(root)
}

function ensureRootIsScheduler(root: FiberRootNode) {
  const updateLane = getHighestPriorityLane(root.pendingLanes)

  if (updateLane === NoLane) {
    return
  }

  if (updateLane === SyncLane) {
    // 同步优先级 用微任务
    if (__DEV__) {
      console.log('use micro task', updateLane)
    }

    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane))
    scheduleMicroTask(flushSyncCallbacks)
  } else {
    // 其他优先级 用宏任务
  }
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

function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
  const nextLane = getHighestPriorityLane(root.pendingLanes)
  if (nextLane !== SyncLane) {
    // 其他 SyncLane 低的优先级
    // NoLane
    ensureRootIsScheduler(root)
    return
  }

  // initialize
  prepareFreshStack(root, lane)

  do {
    try {
      workLoop()
      break
    } catch (e) {
      if (__DEV__) {
        console.warn('workLoop error', e)
      }
      workInProgress = null
    }
  } while (true)

  const finishedWork = root.current.alternate
  root.finishedWork = finishedWork
  root.finishedLane = lane
  workInProgressRootRenderLane = NoLane

  // dom update
  commitRoot(root)
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
  ensureRootIsScheduler(root)
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
  pendingPassiveEffects.unmount.forEach(effect => {
    commitHookEffectListUnmount(Passive, effect)
  })

  pendingPassiveEffects.unmount = []

  pendingPassiveEffects.update.forEach(effect => {
    commitHookEffectListDestroy(Passive | HookHasEffect, effect)
  })

  pendingPassiveEffects.update.forEach(effect => {
    commitHookEffectListCreate(Passive | HookHasEffect, effect)
  })
  pendingPassiveEffects.update = []

  flushSyncCallbacks()
}

function workLoop() {
  while (workInProgress !== null) {
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
