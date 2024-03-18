import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols'
import { FiberNode, createFiberFromElement, createWorkInProgress } from './fiber'
import { Props, ReactElementType } from 'shared/ReactTypes'
import { HostText } from './workTags'
import { ChildDeletion, Placement } from './fiberFlags'

function ChildReconciler(shouldTrackEffects: boolean) {
  function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
    if (!shouldTrackEffects) {
      return
    }

    const deletions = returnFiber.deletions

    if (deletions === null) {
      returnFiber.deletions = [childToDelete]
      returnFiber.flags |= ChildDeletion
    } else {
      deletions.push(childToDelete)
    }
  }

  function reconcileSingleElement(returnFiber: FiberNode, currentFiber: FiberNode | null, element: ReactElementType) {
    const key = element.key

    work: if (currentFiber !== null) {
      // update
      if (currentFiber.key === key) {
        // same key

        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          if (currentFiber.type === element.type) {
            // same type
            const existing = useFiber(currentFiber, element.props)
            existing.return = returnFiber

            return existing
          }

          // delete
          deleteChild(returnFiber, currentFiber)

          break work
        } else {
          if (__DEV__) {
            console.warn('reconcileSingleElement: unknown element type', element)
            break work
          }
        }
      } else {
        // delete
        deleteChild(returnFiber, currentFiber)
      }
    }

    // 根据 element 创建 fiber
    const fiber = createFiberFromElement(element)
    fiber.return = returnFiber
    return fiber
  }

  function reconcileSingleTextNode(returnFiber: FiberNode, currentFiber: FiberNode | null, content: string | number) {
    if (currentFiber !== null) {
      // update
      if (currentFiber.tag === HostText) {
        // same type
        const existing = useFiber(currentFiber, { content })
        existing.return = returnFiber
        return existing
      }

      // delete
      deleteChild(returnFiber, currentFiber)
    }

    const fiber = new FiberNode(HostText, { content }, null)

    fiber.return = returnFiber

    return fiber
  }

  function placeSingleChild(fiber: FiberNode) {
    if (shouldTrackEffects && fiber.alternate === null) {
      fiber.flags |= Placement
    }

    return fiber
  }

  return function reconcileChildFibers(returnFiber: FiberNode, currentFiber: FiberNode | null, newChild: any) {
    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(reconcileSingleElement(returnFiber, currentFiber, newChild))
        default:
          if (__DEV__) {
            console.warn('reconcileChildFibers: unknown child type', newChild)
          }
          break
      }
    }

    // TODO multi node

    // HostText
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      return placeSingleChild(reconcileSingleTextNode(returnFiber, currentFiber, newChild))
    }

    if (currentFiber !== null) {
      deleteChild(returnFiber, currentFiber)
    }

    if (__DEV__) {
      console.warn('reconcileChildFibers: unknown child type', newChild)
    }

    return null
  }
}

function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
  const clone = createWorkInProgress(fiber, pendingProps)
  clone.index = 0
  clone.sibling = null
  return clone
}

export const reconcileChildFibers = ChildReconciler(true)
export const mountChildFibers = ChildReconciler(false)
