/*
 * @Description: start of recursion
 * @Author: Ali
 * @Date: 2024-03-08 16:41:32
 * @LastEditors: ali ali_ovo@qq.com
 * @LastEditTime: 2024-03-16 17:39:49
 */

import { ReactElementType } from 'shared/ReactTypes'
import { FiberNode } from './fiber'
import { UpdateQueue, processUpdateQueue } from './updateQueue'
import { FunctionComponent, HostComponent, HostRoot, HostText } from './workTags'
import { mountChildFibers, reconcileChildFibers } from './childFibers'
import { renderWithHooks } from './fiberHooks'

export const beginWork = (workInProgress: FiberNode) => {
  // compare, return child node
  switch (workInProgress.tag) {
    case HostRoot:
      return updateHostRoot(workInProgress)

    case HostComponent:
      return updateHostComponent(workInProgress)

    case HostText:
      return null

    case FunctionComponent:
      return updateFunctionComponent(workInProgress)

    default:
      if (__DEV__) {
        console.warn('beginWork: unknown fiber tag')
      }

      break
  }

  return null
}

function updateFunctionComponent(workInProgress: FiberNode) {
  const nextChildren = renderWithHooks(workInProgress)
  reconcileChildren(workInProgress, nextChildren)
  return workInProgress.child
}

function updateHostRoot(workInProgress: FiberNode) {
  const baseState = workInProgress.memoizedState

  const updateQueue = workInProgress.updateQueue as UpdateQueue<Element>
  const pending = updateQueue.shard.pending
  updateQueue.shard.pending = null

  const { memoizedState } = processUpdateQueue(baseState, pending)

  workInProgress.memoizedState = memoizedState

  const nextChildren = workInProgress.memoizedState

  reconcileChildren(workInProgress, nextChildren)

  return workInProgress.child
}

function updateHostComponent(workInProgress: FiberNode) {
  const nextProps = workInProgress.pendingProps
  const nextChildren = nextProps.children

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
