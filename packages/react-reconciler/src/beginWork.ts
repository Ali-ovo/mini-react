/*
 * @Description: start of recursion
 * @Author: Ali
 * @Date: 2024-03-08 16:41:32
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-21 15:43:30
 */

import { ReactElementType } from 'shared/ReactTypes'
import { FiberNode } from './fiber'
import { UpdateQueue, processUpdateQueue } from './updateQueue'
import { Fragment, FunctionComponent, HostComponent, HostRoot, HostText } from './workTags'
import { mountChildFibers, reconcileChildFibers } from './childFibers'
import { renderWithHooks } from './fiberHooks'
import { Lane } from './fiberLanes'

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

    default:
      if (__DEV__) {
        console.warn('beginWork: unknown fiber tag')
      }

      break
  }

  return null
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
  const pending = updateQueue.shard.pending
  updateQueue.shard.pending = null

  const { memoizedState } = processUpdateQueue(baseState, pending, renderLane)

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
