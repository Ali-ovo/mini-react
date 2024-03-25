import { Dispatch } from 'react/src/currentDispatch'
import { Action } from 'shared/ReactTypes'
import { Lane, NoLane, isSubsetOfLanes } from './fiberLanes'

export interface Update<State> {
  action: Action<State>
  lane: Lane
  next: Update<any> | null
}

export interface UpdateQueue<State> {
  shard: {
    pending: Update<State> | null
  }

  dispatch: Dispatch<State> | null
}

export const createUpdate = <State>(action: Action<State>, lane: Lane): Update<State> => {
  return {
    action,
    lane,
    next: null
  }
}

export const createUpdateQueue = <State>() => {
  return {
    shard: {
      pending: null
    },
    dispatch: null
  } as UpdateQueue<State>
}

export const enqueueUpdate = <State>(updateQueue: UpdateQueue<State>, update: Update<State>) => {
  const pending = updateQueue.shard.pending
  if (pending === null) {
    // a -> a
    update.next = update
  } else {
    // b -> a -> b
    update.next = pending.next
    pending.next = update
  }

  updateQueue.shard.pending = update
}

export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane
): {
  memoizedState: State
  baseState: State
  baseQueue: Update<State> | null
} => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState,
    baseState,
    baseQueue: null
  }

  if (pendingUpdate !== null) {
    // 第一个update
    const first = pendingUpdate.next
    let pending = pendingUpdate.next as Update<any>

    let newBaseState = baseState
    let newBaseQueueFirst: Update<State> | null = null
    let newBaseQueueLast: Update<State> | null = null
    let newState = baseState

    do {
      const updateLane = pending.lane

      if (!isSubsetOfLanes(renderLane, updateLane)) {
        // 优先级不够 被跳过
        const clone = createUpdate(pending.action, pending.lane)
        // 是不是第一个被跳过的
        if (newBaseQueueFirst === null) {
          newBaseQueueFirst = clone
          newBaseQueueLast = clone
          newBaseState = newState
        } else {
          ;(newBaseQueueLast as Update<State>).next = clone
          newBaseQueueLast = clone
        }
      } else {
        // 优先级足够
        if (newBaseQueueLast !== null) {
          const clone = createUpdate(pending.action, NoLane)
          newBaseQueueLast.next = clone
          newBaseQueueLast = clone
        }

        const action = pendingUpdate.action
        if (action instanceof Function) {
          // baseState 1 update (x) => 4x -> memoizedState 4
          newState = action(baseState)
        } else {
          // baseState 1 update 2 -> memoizedState 2
          newState = action
        }
      }

      pending = pending.next as Update<any>
    } while (pending !== first)

    if (newBaseQueueLast === null) {
      // 本次计算没有 update 被跳过
      newBaseState = newState
    } else {
      newBaseQueueLast.next = newBaseQueueFirst
    }
    result.memoizedState = newState
    result.baseState = newBaseState
    result.baseQueue = newBaseQueueLast
  }

  return result
}
