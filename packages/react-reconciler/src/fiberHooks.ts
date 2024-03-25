/*
 * @Description: fiber hooks
 * @Author: Ali
 * @Date: 2024-03-15 15:24:15
 * @LastEditors: ali ali_ovo@qq.com
 * @LastEditTime: 2024-03-25 22:21:24
 */

import internals from 'shared/internals'
import { FiberNode } from './fiber'
import { Dispatch, Dispatcher } from 'react/src/currentDispatch'
import {
  Update,
  UpdateQueue,
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  processUpdateQueue
} from './updateQueue'
import { Action } from 'shared/ReactTypes'
import { scheduleUpdateOnFiber } from './workLoop'
import { Lane, NoLane, requestUpdateLane } from './fiberLanes'
import { Flags, PassiveEffect } from './fiberFlags'
import { HookHasEffect, Passive } from './hookEffectTags'

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
  deps: EffectDeps
  next: Effect | null
}

export interface FCUpdateQueue<State> extends UpdateQueue<State> {
  lastEffect: Effect | null
}

type EffectCallback = () => void
type EffectDeps = any[] | null

const { currentDispatcher } = internals

export function renderWithHooks(workInProgress: FiberNode, lane: Lane) {
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

  const Component = workInProgress.type
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
  useEffect: mountEffect
}

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useEffect: updateEffect
}

function mountEffect(create: EffectCallback | void, deps: EffectDeps) {
  // 找到当前 useState 的 hook
  const hook = mountWorkInprogressHook()

  const nextDeps = deps === undefined ? null : deps

  ;(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect

  hook.memoizedState = pushEffect(Passive | HookHasEffect, create, undefined, nextDeps)
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps) {
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

function areHookInputsEqual(nextDeps: EffectDeps, prevDeps: EffectDeps): boolean {
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
  deps: EffectDeps
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
  const queue = hook.updateQueue as UpdateQueue<State>
  const baseState = hook.baseState

  const pending = queue.shard.pending
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
    queue.shard.pending = null

    if (baseQueue !== null) {
      const {
        memoizedState,
        baseQueue: newBaseQueue,
        baseState: newBaseState
      } = processUpdateQueue(baseState, baseQueue, renderLane)
      hook.memoizedState = memoizedState
      hook.baseState = newBaseState
      hook.baseQueue = newBaseQueue
    }
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

  const queue = createUpdateQueue<State>()
  hook.updateQueue = queue
  hook.memoizedState = memoizedState

  // @ts-ignore
  const dispatch = dispatchState.bind(null, currentlyRenderingFiber, queue)
  queue.dispatch = dispatch

  return [memoizedState, dispatch]
}

function dispatchState<State>(
  fiber: FiberNode,
  updateQueue: UpdateQueue<State>,
  action: Action<State>
) {
  const lane = requestUpdateLane()

  const update = createUpdate(action, lane)
  enqueueUpdate(updateQueue, update)
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
    memoizedState: currentHook?.memoizedState,
    updateQueue: currentHook?.updateQueue,
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
