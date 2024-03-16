/*
 * @Description: fiber hooks
 * @Author: Ali
 * @Date: 2024-03-15 15:24:15
 * @LastEditors: ali ali_ovo@qq.com
 * @LastEditTime: 2024-03-16 18:48:24
 */

import internals from 'shared/internals'
import { FiberNode } from './fiber'
import { Dispatch, Dispatcher } from 'react/src/currentDispatch'
import { UpdateQueue, createUpdate, createUpdateQueue, enqueueUpdate } from './updateQueue'
import { Action } from 'shared/ReactTypes'
import { scheduleUpdateOnFiber } from './workLoop'

let currentlyRenderingFiber: FiberNode | null = null
let workInprogressHook: Hook | null = null

interface Hook {
  memoizedState: any
  updateQueue: unknown
  next: Hook | null
}

const { currentDispatcher } = internals

export function renderWithHooks(workInProgress: FiberNode) {
  // 赋值
  currentlyRenderingFiber = workInProgress
  workInProgress.memoizedState = null

  const current = workInProgress.alternate

  if (current !== null) {
    // update
  } else {
    // mount
    currentDispatcher.current = HooksDispatcherOnMount
  }

  const Component = workInProgress.type
  const props = workInProgress.pendingProps
  const children = Component(props)

  // 重置
  currentlyRenderingFiber = null
  return children
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState
}

function mountState<State>(initialState: (() => State) | State): [State, Dispatch<State>] {
  // 找到当前 useState 的 hook
  const hook = mountWorkInprogressHook()

  let memoizedState
  if (initialState instanceof Function) {
    memoizedState = initialState()
  } else {
    memoizedState = initialState
  }

  const queue = createUpdateQueue<State>()
  hook.updateQueue = queue
  hook.memoizedState = memoizedState

  // @ts-ignore
  const dispatch = dispatchState.bind(null, currentlyRenderingFiber, queue)
  queue.dispatch = dispatch

  return [memoizedState, dispatch]
}

function dispatchState<State>(fiber: FiberNode, updateQueue: UpdateQueue<State>, action: Action<State>) {
  const update = createUpdate(action)
  enqueueUpdate(updateQueue, update)
  scheduleUpdateOnFiber(fiber)
}

function mountWorkInprogressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    updateQueue: null,
    next: null
  }

  if (workInprogressHook === null) {
    // mount && 第一个hook
    if (currentlyRenderingFiber === null) {
      throw new Error('Hooks can only be called inside the body of a function component')
    } else {
      workInprogressHook = hook
      currentlyRenderingFiber.memoizedState = workInprogressHook
    }
  } else {
    // mount 后的hook
    workInprogressHook.next = hook
    workInprogressHook = hook
  }

  return workInprogressHook
}
