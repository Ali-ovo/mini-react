/*
 * @Description: start of recursion
 * @Author: Ali
 * @Date: 2024-03-08 16:41:32
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-30 17:19:46
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
import { mountChildFibers, reconcileChildFibers } from './childFibers'
import { renderWithHooks } from './fiberHooks'
import { Lane } from './fiberLanes'
import { ChildDeletion, DidCapture, NoFlags, Placement, Ref } from './fiberFlags'
import { pushProvider } from './fiberContext'
import { pushSuspenseHandler } from './suspenseContext'

export const beginWork = (workInProgress: FiberNode, renderLane: Lane) => {
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
  const nextChildren = renderWithHooks(workInProgress, renderLane)
  reconcileChildren(workInProgress, nextChildren)
  return workInProgress.child
}

function updateHostRoot(workInProgress: FiberNode, renderLane: Lane) {
  const baseState = workInProgress.memoizedState

  const updateQueue = workInProgress.updateQueue as UpdateQueue<Element>
  const pending = updateQueue.shared.pending
  updateQueue.shared.pending = null

  const { memoizedState } = processUpdateQueue(baseState, pending, renderLane)

  const current = workInProgress.alternate
  // 考虑RootDidNotComplete的情况，需要复用memoizedState
  if (current !== null) {
    current.memoizedState = memoizedState
  }

  workInProgress.memoizedState = memoizedState

  const nextChildren = workInProgress.memoizedState

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
