import { ReactContext } from 'shared/ReactTypes'
import { FiberNode } from './fiber'
import { Lane, NoLanes, includeSomeLanes, isSubsetOfLanes, mergeLanes } from './fiberLanes'
import { markWorkInProgressReceivedUpdate } from './beginWork'
import { ContextProvider } from './workTags'

let prevContextValue: any = null
const prevContextValueStack: any[] = []

let lastContextDep: ContextItem<any> | null = null

export interface ContextItem<Value> {
  context: ReactContext<Value>
  memoizedState: Value
  next: ContextItem<Value> | null
}

export function pushProvider<T>(context: ReactContext<T>, newValue: T) {
  prevContextValueStack.push(prevContextValue)

  prevContextValue = context.__currentValue
  context.__currentValue = newValue
}

export function popProvider<T>(context: ReactContext<T>) {
  context.__currentValue = prevContextValue

  prevContextValue = prevContextValueStack.pop()
}

export function prepareToReadContext(workInProgress: FiberNode, renderLane: Lane) {
  lastContextDep = null

  const deps = workInProgress.dependencies
  if (deps !== null) {
    const firstContext = deps.firstContext
    if (firstContext !== null) {
      if (includeSomeLanes(deps.lanes, renderLane)) {
        markWorkInProgressReceivedUpdate()
      }

      deps.firstContext = null
    }
  }
}

export function readContext<T>(consumer: FiberNode | null, context: ReactContext<T>): T {
  if (consumer === null) {
    throw new Error('Hooks can only be called inside the body of a function component')
  }

  const value = context.__currentValue

  const contextItem: ContextItem<T> = {
    context,
    next: null,
    memoizedState: value
  }

  if (lastContextDep === null) {
    lastContextDep = contextItem
    consumer.dependencies = {
      firstContext: contextItem,
      lanes: NoLanes
    }
  } else {
    lastContextDep.next = contextItem
  }

  return value
}

export function propagateContextChange<Value>(
  workInProgress: FiberNode,
  context: ReactContext<Value>,
  renderLane: Lane
) {
  let fiber = workInProgress.child
  if (fiber !== null) {
    fiber.return = workInProgress
  }

  while (fiber !== null) {
    let nextFiber = null
    const deps = fiber.dependencies

    if (deps !== null) {
      nextFiber = fiber.child
      let contextItem = deps.firstContext

      while (contextItem !== null) {
        if (contextItem.context === context) {
          fiber.lanes = mergeLanes(fiber.lanes, renderLane)
          const alternate = fiber.alternate
          if (alternate !== null) {
            alternate.lanes = mergeLanes(alternate.lanes, renderLane)
          }

          scheduleContextWorkOnParentPath(fiber.return, workInProgress, renderLane)
          deps.lanes = mergeLanes(deps.lanes, renderLane)
          break
        }

        contextItem = contextItem.next
      }
    } else if (fiber.tag === ContextProvider) {
      nextFiber = fiber.type === workInProgress.type ? null : fiber.child
    } else {
      nextFiber = fiber.child
    }

    if (nextFiber !== null) {
      nextFiber.return = fiber
    } else {
      nextFiber = fiber

      while (nextFiber !== null) {
        if (nextFiber === workInProgress) {
          nextFiber = null
          break
        }

        const sibling = nextFiber.sibling
        if (sibling !== null) {
          sibling.return = nextFiber.return
          nextFiber = sibling
          break
        }

        nextFiber = nextFiber.return
      }
    }

    fiber = nextFiber
  }
}

function scheduleContextWorkOnParentPath(
  from: FiberNode | null,
  to: FiberNode | null,
  renderLane: Lane
) {
  let node = from
  while (node !== null) {
    const alternate = node.alternate

    if (!isSubsetOfLanes(node.childLanes, renderLane)) {
      node.childLanes = mergeLanes(node.childLanes, renderLane)

      if (alternate !== null) {
        alternate.childLanes = mergeLanes(alternate.childLanes, renderLane)
      }
    } else if (alternate !== null && !isSubsetOfLanes(alternate.childLanes, renderLane)) {
      alternate.childLanes = mergeLanes(alternate.childLanes, renderLane)
    }

    if (node === to) {
      break
    }

    node = node.return
  }
}
