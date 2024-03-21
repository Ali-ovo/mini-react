import { Dispatch } from 'react/src/currentDispatch'
import { Action } from 'shared/ReactTypes'
import { Lane } from './fiberLanes'

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
): { memoizedState: State } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState
  }

  if (pendingUpdate !== null) {
    const first = pendingUpdate.next
    let pending = pendingUpdate.next as Update<any>
    do {
      const updateLane = pending.lane
      if (updateLane === renderLane) {
        const action = pendingUpdate.action

        if (action instanceof Function) {
          // baseState 1 update (x) => 4x -> memoizedState 4
          baseState = action(baseState)
        } else {
          // baseState 1 update 2 -> memoizedState 2
          baseState = action
        }
      } else {
        if (__DEV__) {
          console.warn('processUpdateQueue: updateLane !== renderLane')
        }
      }

      pending = pending.next as Update<any>
    } while (pending !== first)
  }

  result.memoizedState = baseState
  return result
}
