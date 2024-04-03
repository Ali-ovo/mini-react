/*
 * @Description: fiber hooks
 * @Author: Ali
 * @Date: 2024-03-15 15:24:15
 * @LastEditors: Ali
 * @LastEditTime: 2024-04-03 11:05:08
 */

import internals from 'shared/internals'
import { FiberNode } from './fiber'
import { Dispatch, Dispatcher } from 'react/src/currentDispatch'
import {
  Update,
  UpdateQueue,
  basicStateReducer,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  processUpdateQueue
} from './updateQueue'
import { Action, ReactContext, Thenable, Usable } from 'shared/ReactTypes'
import { scheduleUpdateOnFiber } from './workLoop'
import { Lane, NoLane, NoLanes, mergeLanes, removeLanes, requestUpdateLane } from './fiberLanes'
import { Flags, PassiveEffect } from './fiberFlags'
import { HookHasEffect, Passive } from './hookEffectTags'
import currentBatchConfig from 'react/src/currentBatchConfig'
import { REACT_CONTEXT_TYPE } from 'shared/ReactSymbols'
import { trackUsedThenable } from './thenable'
import { markWorkInProgressReceivedUpdate } from './beginWork'
import { readContext as readContextOrigin } from './fiberContext'

let currentlyRenderingFiber: FiberNode | null = null
let workInprogressHook: Hook | null = null
let currentHook: Hook | null = null
let renderLane: Lane = NoLane

interface Hook {
  memoizedState: any
  updateQueue: unknown
  next: Hook | null
  baseState: any
  baseQueue: Update<any> | null
}

export interface Effect {
  tag: Flags
  create: EffectCallback | void
  destroy: EffectCallback | void
  deps: HookDeps
  next: Effect | null
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null
  lastRenderedState: State
}

type EffectCallback = () => void
export type HookDeps = any[] | null

const { currentDispatcher } = internals

export function renderWithHooks(
  workInProgress: FiberNode,
  Component: FiberNode['type'],
  lane: Lane
) {
  // 赋值
  currentlyRenderingFiber = workInProgress

  // 重置链表
  workInProgress.memoizedState = null

  // 重置 effect
  workInProgress.updateQueue = null
  renderLane = lane

  const current = workInProgress.alternate

  if (current !== null) {
    // update
    currentDispatcher.current = HooksDispatcherOnUpdate
  } else {
    // mount
    currentDispatcher.current = HooksDispatcherOnMount
  }

  const props = workInProgress.pendingProps
  const children = Component(props)

  // 重置
  currentlyRenderingFiber = null
  workInprogressHook = null
  currentHook = null
  renderLane = NoLane

  return children
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
  useEffect: mountEffect,
  useTransition: mountTransition,
  useRef: mountRef,
  useContext: readContext,
  use,
  useMemo: mountMemo,
  useCallback: mountCallback
}

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect,
  useTransition: updateTransition,
  useRef: updateRef,
  useContext: readContext,
  use,
  useMemo: updateMemo,
  useCallback: updateCallback
}

function mountRef<T>(initialValue: T): { current: T } {
  const hook = mountWorkInprogressHook()
  const ref = { current: initialValue }
  hook.memoizedState = ref
  return ref
}

function updateRef<T>(initialValue: T): { current: T } {
  const hook = updateWorkInprogressHook()
  return hook.memoizedState
}

function mountEffect(create: EffectCallback | void, deps: HookDeps | undefined) {
  // 找到当前 useState 的 hook
  const hook = mountWorkInprogressHook()

  const nextDeps = deps === undefined ? null : deps

  ;(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect

  hook.memoizedState = pushEffect(Passive | HookHasEffect, create, undefined, nextDeps)
}

function updateEffect(create: EffectCallback | void, deps: HookDeps | undefined) {
  // 找到当前 useState 的 hook
  const hook = updateWorkInprogressHook()
  const nextDeps = deps === undefined ? null : deps
  let destroy: EffectCallback | void

  if (currentHook !== null) {
    const prevEffect = currentHook.memoizedState as Effect
    destroy = prevEffect.destroy

    if (nextDeps !== null) {
      // 浅比较
      const preDeps = prevEffect.deps
      if (areHookInputsEqual(nextDeps, preDeps)) {
        hook.memoizedState = pushEffect(Passive, create, destroy, nextDeps)
        return
      }
    }

    // 依赖变化
    ;(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect

    hook.memoizedState = pushEffect(Passive | HookHasEffect, create, destroy, nextDeps)
  }
}

function areHookInputsEqual(nextDeps: HookDeps, prevDeps: HookDeps): boolean {
  if (prevDeps === null || nextDeps === null) {
    return false
  }

  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(prevDeps[i], nextDeps[i])) {
      continue
    }

    return false
  }

  return true
}

function pushEffect(
  hookFlags: Flags,
  create: EffectCallback | void,
  destroy: EffectCallback | void,
  deps: HookDeps
): Effect {
  const effect: Effect = {
    tag: hookFlags,
    create,
    deps,
    destroy,
    next: null
  }

  const fiber = currentlyRenderingFiber as FiberNode

  let updateQueue = fiber.updateQueue as FCUpdateQueue<any>

  if (updateQueue === null) {
    updateQueue = createFCUpdateQueue()
    fiber.updateQueue = updateQueue
    effect.next = effect
    updateQueue.lastEffect = effect
  } else {
    // 插入 effect
    const lastEffect = updateQueue.lastEffect

    if (lastEffect === null) {
      effect.next = effect
      updateQueue.lastEffect = effect
    } else {
      const firstEffect = lastEffect.next
      lastEffect.next = effect
      effect.next = firstEffect
      updateQueue.lastEffect = effect
    }
  }

  return effect
}

function createFCUpdateQueue<State>() {
  const updateQueue = createUpdateQueue<State>() as FCUpdateQueue<State>

  updateQueue.lastEffect = null

  return updateQueue
}

function updateState<State>(): [State, Dispatch<State>] {
  // 找到当前 useState 的 hook
  const hook = updateWorkInprogressHook()

  // 计算 state
  const queue = hook.updateQueue as FCUpdateQueue<State>
  const baseState = hook.baseState

  const pending = queue.shared.pending
  const current = currentHook as Hook
  let baseQueue = current.baseQueue

  // update保存在current
  if (pending !== null) {
    if (baseQueue !== null) {
      const baseFirst = baseQueue.next
      const pendingFirst = pending.next

      baseQueue.next = pendingFirst
      pending.next = baseFirst
    }

    baseQueue = pending

    // 保存在current
    current.baseQueue = pending
    queue.shared.pending = null
  }

  if (baseQueue !== null) {
    const prevState = hook.memoizedState
    const {
      memoizedState,
      baseQueue: newBaseQueue,
      baseState: newBaseState
    } = processUpdateQueue(baseState, baseQueue, renderLane, update => {
      const skippedLane = update.lane
      const fiber = currentlyRenderingFiber as FiberNode

      fiber.lanes = mergeLanes(fiber.lanes, skippedLane)
    })

    if (!Object.is(prevState, memoizedState)) {
      markWorkInProgressReceivedUpdate()
    }

    hook.memoizedState = memoizedState
    hook.baseState = newBaseState
    hook.baseQueue = newBaseQueue

    queue.lastRenderedState = memoizedState
  }

  return [hook.memoizedState, queue.dispatch as Dispatch<State>]
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

  const queue = createFCUpdateQueue<State>()
  hook.updateQueue = queue
  hook.memoizedState = memoizedState
  hook.baseState = memoizedState

  // @ts-ignore
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue)
  queue.dispatch = dispatch
  queue.lastRenderedState = memoizedState

  return [memoizedState, dispatch]
}

function mountTransition(): [boolean, (callback: () => void) => void] {
  const [isPending, setPending] = mountState(false)
  const hook = mountWorkInprogressHook()

  const start = startTransition.bind(null, setPending)
  hook.memoizedState = start

  return [isPending, start]
}

function updateTransition(): [boolean, (callback: () => void) => void] {
  const [isPending] = updateState()
  const hook = updateWorkInprogressHook()

  const start = hook.memoizedState

  return [isPending as boolean, start]
}

function startTransition(setPending: Dispatch<boolean>, callback: () => void) {
  setPending(true)
  const preTransition = currentBatchConfig.transition
  currentBatchConfig.transition = 1

  callback()
  setPending(false)

  currentBatchConfig.transition = preTransition
}

function dispatchSetState<State>(
  fiber: FiberNode,
  updateQueue: FCUpdateQueue<State>,
  action: Action<State>
) {
  const lane = requestUpdateLane()
  const update = createUpdate(action, lane)

  // eager 策略
  const current = fiber.alternate
  if (fiber.lanes === NoLanes && (current === null || current.lanes === NoLanes)) {
    // 当前产生的update是这个fiber的第一个update
    const currentState = updateQueue.lastRenderedState
    const eagerState = basicStateReducer(currentState, action)
    update.hasEagerState = true
    update.eagerState = eagerState

    if (Object.is(currentState, eagerState)) {
      enqueueUpdate(updateQueue, update, fiber, NoLane)

      // eagerState和currentState相等，不需要更新
      if (__DEV__) {
        console.log('命中eagerState', fiber)
      }
      return
    }
  }

  enqueueUpdate(updateQueue, update, fiber, lane)
  scheduleUpdateOnFiber(fiber, lane)
}

function mountWorkInprogressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    updateQueue: null,
    next: null,
    baseQueue: null,
    baseState: null
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

function updateWorkInprogressHook(): Hook {
  // TODO: render 更新
  let nextCurrentHook: Hook | null

  if (currentHook === null) {
    // FC update的第一个hook
    const current = currentlyRenderingFiber?.alternate

    if (current !== null) {
      nextCurrentHook = current?.memoizedState
    } else {
      nextCurrentHook = null
    }
  } else {
    // update时 后续的hook
    nextCurrentHook = currentHook.next
  }

  if (nextCurrentHook === null) {
    throw new Error(`组件 ${currentlyRenderingFiber?.type} 的 hooks 链表为空`)
  }

  currentHook = nextCurrentHook as Hook

  const newHook: Hook = {
    memoizedState: currentHook.memoizedState,
    updateQueue: currentHook.updateQueue,
    next: null,
    baseQueue: currentHook.baseQueue,
    baseState: currentHook.baseState
  }

  if (workInprogressHook === null) {
    // mount && 第一个hook
    if (currentlyRenderingFiber === null) {
      throw new Error('Hooks can only be called inside the body of a function component')
    } else {
      workInprogressHook = newHook
      currentlyRenderingFiber.memoizedState = workInprogressHook
    }
  } else {
    // mount 后的hook
    workInprogressHook.next = newHook
    workInprogressHook = newHook
  }

  return workInprogressHook
}

function readContext<Value>(context: ReactContext<Value>): Value {
  return readContextOrigin(currentlyRenderingFiber, context)
}

function use<T>(usable: Usable<T>): T {
  if (usable !== null && typeof usable === 'object') {
    if (typeof (usable as Thenable<T>).then === 'function') {
      const thenable = usable as Thenable<T>
      return trackUsedThenable(thenable)
    } else if ((usable as ReactContext<T>).$$typeof === REACT_CONTEXT_TYPE) {
      const context = usable as ReactContext<T>
      return readContext(context)
    }
  }
  throw new Error('不支持的use参数 ' + usable)
}

export function resetHooksOnUnwind(workInProgress: FiberNode) {
  currentlyRenderingFiber = null
  currentHook = null
  workInprogressHook = null
}

export function bailoutHook(workInProgress: FiberNode, renderLane: Lane) {
  const current = workInProgress.alternate as FiberNode
  workInProgress.updateQueue = current.updateQueue
  workInProgress.flags &= ~PassiveEffect

  current.lanes = removeLanes(current.lanes, renderLane)
}

function mountCallback<T>(callback: T, deps: HookDeps | undefined): T {
  const hook = mountWorkInprogressHook()
  const nextDeps = deps === undefined ? null : deps
  hook.memoizedState = [callback, nextDeps]
  return callback
}

function updateCallback<T>(callback: T, deps: HookDeps | undefined): T {
  const hook = updateWorkInprogressHook()
  const nextDeps = deps === undefined ? null : deps
  const prevState = hook.memoizedState

  if (nextDeps !== null) {
    const prevDeps = prevState[1]
    if (areHookInputsEqual(nextDeps, prevDeps)) {
      return prevState[0]
    }
  }

  hook.memoizedState = [callback, nextDeps]
  return callback
}

function mountMemo<T>(nextCreate: () => T, deps: HookDeps | undefined): T {
  const hook = mountWorkInprogressHook()
  const nextDeps = deps === undefined ? null : deps
  const nextValue = nextCreate()
  hook.memoizedState = [nextValue, nextDeps]
  return nextValue
}

function updateMemo<T>(nextCreate: () => T, deps: HookDeps | undefined): T {
  const hook = updateWorkInprogressHook()
  const nextDeps = deps === undefined ? null : deps
  const prevState = hook.memoizedState

  if (nextDeps !== null) {
    const prevDeps = prevState[1]
    if (areHookInputsEqual(nextDeps, prevDeps)) {
      return prevState[0]
    }
  }

  const nextValue = nextCreate()
  hook.memoizedState = [nextValue, nextDeps]
  return nextValue
}
