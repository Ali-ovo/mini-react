import { scheduleMicroTask } from 'hostConfig'
import { beginWork } from './beginWork'
import {
  commitHookEffectListCreate,
  commitHookEffectListDestroy,
  commitHookEffectListUnmount,
  commitLayoutEffects,
  commitMutationEffects
} from './commitWork'
import { completeWork } from './completeWork'
import { FiberNode, FiberRootNode, PendingPassiveEffects, createWorkInProgress } from './fiber'
import { HostEffectMask, MutationMask, NoFlags, PassiveMask } from './fiberFlags'
import {
  Lane,
  NoLane,
  SyncLane,
  getHighestPriorityLane,
  getNextLane,
  lanesToSchedulerPriority,
  markRootFinished,
  markRootSuspended,
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
import { SuspenseException, getSuspenseThenable } from './thenable'
import { resetHooksOnUnwind } from './fiberHooks'
import { throwException } from './fiberThrow'
import { unwindWork } from './fiberUnwindWork'

let workInProgress: FiberNode | null = null
let workInProgressRootRenderLane: Lane = NoLane
let rootDoesHasPassiveEffects = false

type RootExitStatus = number

// 工作中
const RootInProgress = 0
// 并发更新 中途打断
const RootInComplete = 1
// render 完成
const RootCompleted = 2
// 由于挂起 不进入 commit
const RootDidNotComplete = 3
let wipRootExitStatus = RootInProgress

type SuspendedReason = typeof NotSuspended | typeof SuspendedOnData
const NotSuspended = 0
const SuspendedOnData = 6
let workInProgressSuspendedReason: SuspendedReason = NotSuspended
let workInProgressThrownValue: any = null

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = NoLane
  root.finishedWork = null
  workInProgress = createWorkInProgress(root.current, {})
  workInProgressRootRenderLane = lane

  wipRootExitStatus = RootInProgress
  workInProgressSuspendedReason = NotSuspended
  workInProgressThrownValue = null
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  const root = markUpdateLanesFromFiberToRoot(fiber, lane)

  markRootUpdated(root, lane)
  ensureRootIsScheduled(root)
}

// schedule阶段入口
export function ensureRootIsScheduled(root: FiberRootNode) {
  const updateLane = getNextLane(root)
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

  if (__DEV__) {
    console.log(`在 ${updateLane === SyncLane ? '微' : '宏'} 任务中调度更新`, updateLane)
  }

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

export function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane)
}

function markUpdateLanesFromFiberToRoot(fiber: FiberNode, lane: Lane) {
  let node = fiber
  let parent = node.return

  while (parent !== null) {
    parent.childLanes = mergeLanes(parent.childLanes, lane)
    const alternate = parent.alternate
    if (alternate !== null) {
      alternate.childLanes = mergeLanes(alternate.childLanes, lane)
    }

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

  const lane = getNextLane(root)
  const curCallbackNode = root.callbackNode

  if (lane === NoLane) {
    return null
  }

  const needSync = lane === SyncLane || didTimeout
  const exitStatus = renderRoot(root, lane, !needSync)

  switch (exitStatus) {
    case RootInComplete:
      if (root.callbackNode !== curCallbackNode) {
        return null
      }

      return performConcurrentWorkOnRoot.bind(null, root)
    case RootCompleted:
      const finishedWork = root.current.alternate
      root.finishedWork = finishedWork
      root.finishedLane = lane
      workInProgressRootRenderLane = NoLane

      // dom update
      commitRoot(root)
      break
    case RootDidNotComplete:
      workInProgressRootRenderLane = NoLane
      markRootSuspended(root, lane)
      ensureRootIsScheduled(root)
      break

    default:
      if (__DEV__) {
        console.warn('performSyncWorkOnRoot: 还未实现并发更新结束的状态')
      }
      break
  }
}

function performSyncWorkOnRoot(root: FiberRootNode) {
  const nextLane = getNextLane(root)
  if (nextLane !== SyncLane) {
    // 其他比SyncLane低的优先级
    // NoLane
    ensureRootIsScheduled(root)
    return
  }

  const exitStatus = renderRoot(root, nextLane, false)

  switch (exitStatus) {
    case RootCompleted:
      const finishedWork = root.current.alternate
      root.finishedWork = finishedWork
      root.finishedLane = nextLane
      workInProgressRootRenderLane = NoLane

      // wip fiberNode树 树中的flags
      commitRoot(root)
      break

    case RootDidNotComplete:
      workInProgressRootRenderLane = NoLane
      markRootSuspended(root, nextLane)
      ensureRootIsScheduled(root)
      break

    default:
      if (__DEV__) {
        console.error('还未实现的同步更新结束状态')
      }
      break
  }
}

function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
  if (__DEV__) {
    console.log(`开始${shouldTimeSlice ? '并发' : '同步'}更新`, root)
  }

  if (workInProgressRootRenderLane !== lane) {
    // 初始化
    prepareFreshStack(root, lane)
  }

  do {
    try {
      if (workInProgressSuspendedReason !== NotSuspended && workInProgress !== null) {
        const thrownValue = workInProgressThrownValue

        workInProgressSuspendedReason = NotSuspended
        workInProgressThrownValue = null

        throwAndUnwindWorkLoop(root, workInProgress, thrownValue, lane)
      }

      shouldTimeSlice ? workLoopConcurrent() : workLoopSync()
      break
    } catch (e) {
      if (__DEV__) {
        console.warn('workLoop发生错误', e)
      }

      handleThrow(root, e)
    }
  } while (true)

  if (wipRootExitStatus !== RootInProgress) {
    return wipRootExitStatus
  }

  // 中断执行
  if (shouldTimeSlice && workInProgress !== null) {
    return RootInComplete
  }
  // render阶段执行完
  if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
    console.error(`render阶段结束时wip不应该不是null`)
  }
  // TODO 报错
  return RootCompleted
}

function throwAndUnwindWorkLoop(
  root: FiberRootNode,
  unitOfWork: FiberNode,
  thrownValue: any,
  lane: Lane
) {
  // 重置 FC 变量
  resetHooksOnUnwind(unitOfWork)

  // 请求返回后触发更新
  throwException(root, thrownValue, lane)

  // unwind
  unwindUnitOfWork(unitOfWork)
}

function unwindUnitOfWork(unitOfWork: FiberNode) {
  let incompleteWork: FiberNode | null = unitOfWork
  do {
    const next = unwindWork(incompleteWork)

    if (next !== null) {
      next.flags &= HostEffectMask
      workInProgress = next
      return
    }

    const returnFiber = incompleteWork.return as FiberNode
    if (returnFiber !== null) {
      returnFiber.deletions = null
    }
    incompleteWork = returnFiber
  } while (incompleteWork !== null)

  // 没有 边界 中止unwind流程，一直到root
  wipRootExitStatus = RootDidNotComplete
  workInProgress = null
}

function handleThrow(root: FiberRootNode, thrownValue: any) {
  // Error Boundary

  if (thrownValue === SuspenseException) {
    workInProgressSuspendedReason = SuspendedOnData
    thrownValue = getSuspenseThenable()
  }

  workInProgressThrownValue = thrownValue
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork

  if (finishedWork === null) {
    return
  }

  if (__DEV__) {
    console.warn('commit阶段开始', finishedWork)
  }
  const lane = root.finishedLane

  if (lane === NoLane && __DEV__) {
    console.error('commit阶段finishedLane不应该是NoLane')
  }

  // 重置
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
        // 执行副作用
        flushPassiveEffects(root.pendingPassiveEffects)
        return
      })
    }
  }

  // 判断是否存在3个子阶段需要执行的操作
  // root flags root subtreeFlags
  const subtreeHasEffect = (finishedWork.subtreeFlags & (MutationMask | PassiveMask)) !== NoFlags
  const rootHasEffect = (finishedWork.flags & (MutationMask | PassiveMask)) !== NoFlags

  if (subtreeHasEffect || rootHasEffect) {
    // beforeMutation
    // mutation Placement
    commitMutationEffects(finishedWork, root)

    root.current = finishedWork

    // 阶段3/3:Layout
    commitLayoutEffects(finishedWork, root)
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

function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress)
  }
}
function workLoopConcurrent() {
  while (workInProgress !== null && !unstable_shouldYield()) {
    performUnitOfWork(workInProgress)
  }
}

function performUnitOfWork(fiber: FiberNode) {
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

    if (sibling !== null) {
      workInProgress = sibling
      return
    }
    node = node.return
    workInProgress = node
  } while (node !== null)
}
