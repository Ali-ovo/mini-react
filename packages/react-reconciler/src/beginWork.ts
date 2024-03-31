/*
 * @Description: start of recursion
 * @Author: Ali
 * @Date: 2024-03-08 16:41:32
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-31 14:03:49
 */

import { ReactElementType } from 'shared/ReactTypes'
import {
  FiberNode,
  OffscreenProps,
  createFiberFromFragment,
  createFiberFromOffscreen,
  createWorkInProgress
} from './fiber'
import { UpdateQueue, processUpdateQueue } from './updateQueue'
import {
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  OffscreenComponent,
  SuspenseComponent
} from './workTags'
import { cloneChildFibers, mountChildFibers, reconcileChildFibers } from './childFibers'
import { bailoutHook, renderWithHooks } from './fiberHooks'
import { Lane, NoLanes, includeSomeLanes } from './fiberLanes'
import { ChildDeletion, DidCapture, NoFlags, Placement, Ref } from './fiberFlags'
import { pushProvider } from './fiberContext'
import { pushSuspenseHandler } from './suspenseContext'

let didReceiveUpdate = false

export function markWorkInProgressReceivedUpdate() {
  didReceiveUpdate = true
}

export const beginWork = (workInProgress: FiberNode, renderLane: Lane) => {
  didReceiveUpdate = false
  const current = workInProgress.alternate

  if (current !== null) {
    const oldProps = current.memoizedProps
    const newProps = workInProgress.pendingProps

    if (oldProps !== newProps || current.type !== workInProgress.type) {
      didReceiveUpdate = true
    } else {
      // state context
      const hasScheduledStateOrContext = checkScheduledUpdateOrContext(current, renderLane)

      if (!hasScheduledStateOrContext) {
        // bailout
        didReceiveUpdate = false

        switch (workInProgress.tag) {
          case ContextProvider:
            const newValue = workInProgress.memoizedProps.value
            const context = workInProgress.type._context
            pushProvider(context, newValue)
            break
          // TODO: Suspense
        }

        return bailoutOnAlreadyFinishedWork(workInProgress, renderLane)
      }
    }
  }

  workInProgress.lanes = NoLanes

  // compare, return child node
  switch (workInProgress.tag) {
    case HostRoot:
      return updateHostRoot(workInProgress, renderLane)

    case HostComponent:
      return updateHostComponent(workInProgress)

    case HostText:
      return null

    case FunctionComponent:
      return updateFunctionComponent(workInProgress, renderLane)

    case Fragment:
      return updateFragment(workInProgress)

    case ContextProvider:
      return updateContextProvider(workInProgress)

    case SuspenseComponent:
      return updateSuspenseComponent(workInProgress)

    case OffscreenComponent:
      return updateOffscreenComponent(workInProgress)

    default:
      if (__DEV__) {
        console.warn('beginWork: unknown fiber tag')
      }

      break
  }

  return null
}

function bailoutOnAlreadyFinishedWork(workInProgress: FiberNode, renderLane: Lane) {
  if (!includeSomeLanes(workInProgress.childLanes, renderLane)) {
    if (__DEV__) {
      console.warn('bailout: 整个子树', workInProgress)
    }

    return null
  }

  if (__DEV__) {
    console.warn('bailout: 部分子树', workInProgress)
  }

  cloneChildFibers(workInProgress)
  return workInProgress.child
}

function checkScheduledUpdateOrContext(current: FiberNode, renderLane: Lane): boolean {
  const updateLanes = current.lanes
  if (includeSomeLanes(updateLanes, renderLane)) {
    return true
  }

  return false
}

function updateSuspenseComponent(workInProgress: FiberNode) {
  const current = workInProgress.alternate
  const nextProps = workInProgress.pendingProps

  let showFallback = false
  const didSuspend = (workInProgress.flags & DidCapture) !== NoFlags
  if (didSuspend) {
    showFallback = true
    workInProgress.flags &= ~DidCapture
  }

  const newPrimaryChildren = nextProps.children
  const nextFallbackChildren = nextProps.fallback

  pushSuspenseHandler(workInProgress)

  if (current === null) {
    // mount
    if (showFallback) {
      // 挂起
      return mountSuspenseFallbackChildren(workInProgress, newPrimaryChildren, nextFallbackChildren)
    } else {
      // 正常
      return mountSuspensePrimaryChildren(workInProgress, newPrimaryChildren)
    }
  } else {
    // update
    if (showFallback) {
      // 挂起
      return updateSuspenseFallbackChildren(
        workInProgress,
        newPrimaryChildren,
        nextFallbackChildren
      )
    } else {
      // 正常
      return updateSuspensePrimaryChildren(workInProgress, newPrimaryChildren)
    }
  }
}

function updateSuspensePrimaryChildren(workInProgress: FiberNode, primaryChildren: any) {
  const current = workInProgress.alternate as FiberNode
  const currentPrimaryChildFragment = current.child as FiberNode
  const currentFallbackChildFragment = currentPrimaryChildFragment.sibling as FiberNode

  const primaryChildProps: OffscreenProps = {
    mode: 'visible',
    children: primaryChildren
  }
  const primaryChildFragment = createWorkInProgress(currentPrimaryChildFragment, primaryChildProps)

  primaryChildFragment.return = workInProgress
  primaryChildFragment.sibling = null
  workInProgress.child = primaryChildFragment

  if (currentFallbackChildFragment !== null) {
    const deletions = workInProgress.deletions
    if (deletions === null) {
      workInProgress.deletions = [currentFallbackChildFragment]
      workInProgress.flags |= ChildDeletion
    } else {
      deletions.push(currentFallbackChildFragment)
    }
  }

  return primaryChildFragment
}

function updateSuspenseFallbackChildren(
  workInProgress: FiberNode,
  primaryChildren: any,
  fallbackChildren: any
) {
  const current = workInProgress.alternate as FiberNode
  const currentPrimaryChildFragment = current.child as FiberNode
  const currentFallbackChildFragment = currentPrimaryChildFragment.sibling as FiberNode

  const primaryChildProps: OffscreenProps = {
    mode: 'hidden',
    children: primaryChildren
  }

  const primaryChildFragment = createWorkInProgress(currentPrimaryChildFragment, primaryChildProps)
  let fallbackChildFragment

  if (currentFallbackChildFragment !== null) {
    fallbackChildFragment = createWorkInProgress(currentFallbackChildFragment, fallbackChildren)
  } else {
    fallbackChildFragment = createFiberFromFragment(fallbackChildren, null)
    fallbackChildFragment.flags |= Placement
  }

  fallbackChildFragment.return = workInProgress
  primaryChildFragment.return = workInProgress
  primaryChildFragment.sibling = fallbackChildFragment
  workInProgress.child = primaryChildFragment
  return fallbackChildFragment
}

function mountSuspensePrimaryChildren(workInProgress: FiberNode, primaryChildren: any) {
  const primaryChildProps: OffscreenProps = {
    mode: 'visible',
    children: primaryChildren
  }

  const primaryChildFragment = createFiberFromOffscreen(primaryChildProps)

  workInProgress.child = primaryChildFragment
  primaryChildFragment.return = workInProgress

  return primaryChildFragment
}

function mountSuspenseFallbackChildren(
  workInProgress: FiberNode,
  primaryChildren: any,
  fallbackChildren: any
) {
  const primaryChildProps: OffscreenProps = {
    mode: 'hidden',
    children: primaryChildren
  }

  const primaryChildFragment = createFiberFromOffscreen(primaryChildProps)
  const fallbackChildFragment = createFiberFromFragment(fallbackChildren, null)
  fallbackChildFragment.flags |= Placement

  primaryChildFragment.return = workInProgress
  fallbackChildFragment.return = workInProgress
  primaryChildFragment.sibling = fallbackChildFragment
  workInProgress.child = primaryChildFragment

  return fallbackChildFragment
}

function updateOffscreenComponent(workInProgress: FiberNode) {
  const nextProps = workInProgress.pendingProps
  const nextChildren = nextProps.children

  reconcileChildren(workInProgress, nextChildren)
  return workInProgress.child
}

function updateContextProvider(workInProgress: FiberNode) {
  const providerType = workInProgress.type
  const context = providerType._context
  const newProps = workInProgress.pendingProps

  pushProvider(context, newProps.value)

  const nextChildren = newProps.children
  reconcileChildren(workInProgress, nextChildren)
  return workInProgress.child
}

function updateFragment(workInProgress: FiberNode) {
  const nextChildren = workInProgress.pendingProps
  reconcileChildren(workInProgress, nextChildren)
  return workInProgress.child
}

function updateFunctionComponent(workInProgress: FiberNode, renderLane: Lane) {
  // render
  const nextChildren = renderWithHooks(workInProgress, renderLane)

  const current = workInProgress.alternate
  if (current !== null && !didReceiveUpdate) {
    // bailout
    bailoutHook(workInProgress, renderLane)
    return bailoutOnAlreadyFinishedWork(workInProgress, renderLane)
  }

  reconcileChildren(workInProgress, nextChildren)
  return workInProgress.child
}

function updateHostRoot(workInProgress: FiberNode, renderLane: Lane) {
  const baseState = workInProgress.memoizedState

  const updateQueue = workInProgress.updateQueue as UpdateQueue<Element>
  const pending = updateQueue.shared.pending
  updateQueue.shared.pending = null

  const prevChildren = workInProgress.memoizedState

  const { memoizedState } = processUpdateQueue(baseState, pending, renderLane)
  workInProgress.memoizedState = memoizedState

  const current = workInProgress.alternate
  // 考虑RootDidNotComplete的情况，需要复用memoizedState
  if (current !== null) {
    if (!current.memoizedState) {
      current.memoizedState = memoizedState
    }
  }

  const nextChildren = workInProgress.memoizedState
  if (prevChildren === nextChildren) {
    return bailoutOnAlreadyFinishedWork(workInProgress, renderLane)
  }
  reconcileChildren(workInProgress, nextChildren)
  return workInProgress.child
}

function updateHostComponent(workInProgress: FiberNode) {
  const nextProps = workInProgress.pendingProps
  const nextChildren = nextProps.children

  markRef(workInProgress.alternate, workInProgress)
  reconcileChildren(workInProgress, nextChildren)

  return workInProgress.child
}

function reconcileChildren(workInProgress: FiberNode, children?: ReactElementType) {
  const current = workInProgress.alternate

  if (current !== null) {
    // update
    workInProgress.child = reconcileChildFibers(workInProgress, current?.child, children)
  } else {
    // mount
    workInProgress.child = mountChildFibers(workInProgress, null, children)
  }
}

function markRef(current: FiberNode | null, workInProgress: FiberNode) {
  const ref = workInProgress.ref

  if ((current === null && ref !== null) || (current !== null && current.ref !== ref)) {
    workInProgress.flags |= Ref
  }
}
