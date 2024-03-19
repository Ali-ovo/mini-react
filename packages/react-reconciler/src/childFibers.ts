import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols'
import { FiberNode, createFiberFromElement, createWorkInProgress } from './fiber'
import { Props, ReactElementType } from 'shared/ReactTypes'
import { HostText } from './workTags'
import { ChildDeletion, Placement } from './fiberFlags'

type ExistingChildren = Map<string | number, FiberNode>

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

  function deleteRemainingChildren(returnFiber: FiberNode, currentFirstChild: FiberNode | null) {
    if (!shouldTrackEffects) {
      return
    }

    let childToDelete = currentFirstChild
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete)
      childToDelete = childToDelete.sibling
    }
  }

  function reconcileSingleElement(returnFiber: FiberNode, currentFiber: FiberNode | null, element: ReactElementType) {
    const key = element.key

    while (currentFiber !== null) {
      // update
      if (currentFiber.key === key) {
        // same key

        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          if (currentFiber.type === element.type) {
            // same type
            const existing = useFiber(currentFiber, element.props)
            existing.return = returnFiber

            // 当前节点可以服用 需要删除其他节点
            deleteRemainingChildren(returnFiber, currentFiber.sibling)
            return existing
          }

          // key not match and type not match delete all
          deleteChild(returnFiber, currentFiber)

          break
        } else {
          if (__DEV__) {
            console.warn('reconcileSingleElement: unknown element type', element)
            break
          }
        }
      } else {
        // key not match delete
        deleteChild(returnFiber, currentFiber)

        currentFiber = currentFiber.sibling
      }
    }

    // 根据 element 创建 fiber
    const fiber = createFiberFromElement(element)
    fiber.return = returnFiber
    return fiber
  }

  function reconcileSingleTextNode(returnFiber: FiberNode, currentFiber: FiberNode | null, content: string | number) {
    while (currentFiber !== null) {
      // update
      if (currentFiber.tag === HostText) {
        // same type
        const existing = useFiber(currentFiber, { content })
        existing.return = returnFiber

        // 当前节点可以服用 需要删除其他节点
        deleteRemainingChildren(returnFiber, currentFiber.sibling)
        return existing
      }

      // delete
      deleteChild(returnFiber, currentFiber)
      currentFiber = currentFiber.sibling
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

  function reconcileChildrenArray(returnFiber: FiberNode, currentFirstChild: FiberNode | null, newChild: any) {
    // 最后一个可复用的 fiber 的 index
    let lastPlacedIndex: number = 0

    // 最后一个fiber
    let lastNewFiber: FiberNode | null = null

    // 第一个新的 fiber
    let firstNewFiber: FiberNode | null = null

    // 将 current fiber 转换为 map
    const existingChildren: ExistingChildren = new Map()

    let current = currentFirstChild
    while (current !== null) {
      const keyToUse = current.key !== null ? current.key : current.index

      existingChildren.set(keyToUse, current)

      current = current.sibling
    }

    // 遍历 newChild 寻找是否可复用
    for (let i = 0; i < newChild.length; i++) {
      const after = newChild[i]
      const newFiber = updateFromMap(returnFiber, existingChildren, i, after)

      if (newFiber === null) {
        continue
      }

      // 标记移动还是插入
      newFiber.index = i
      newFiber.return = returnFiber

      if (lastNewFiber === null) {
        firstNewFiber = newFiber
        lastNewFiber = newFiber
      } else {
        lastNewFiber.sibling = newFiber
        lastNewFiber = lastNewFiber.sibling
      }

      if (!shouldTrackEffects) {
        continue
      }

      const current = newFiber.alternate

      if (current !== null) {
        const oldIndex = current.index
        if (oldIndex < lastPlacedIndex) {
          // 移动
          newFiber.flags |= Placement
          continue
        } else {
          // 不移动
          lastPlacedIndex = oldIndex
        }
      } else {
        // mount
        newFiber.flags |= Placement
      }
    }

    // 删除多余的节点
    existingChildren.forEach(fiber => {
      deleteChild(returnFiber, fiber)
    })

    return firstNewFiber
  }

  function updateFromMap(
    returnFiber: FiberNode,
    existingChildren: ExistingChildren,
    index: number,
    element: any
  ): FiberNode | null {
    const keyToUse = element.key !== null ? element.key : index
    const before = existingChildren.get(keyToUse)

    if (typeof element === 'string' || typeof element === 'number') {
      // HostText
      if (before) {
        if (before.tag === HostText) {
          existingChildren.delete(keyToUse)
          return useFiber(before, { content: element + '' })
        }
      }

      return new FiberNode(HostText, { content: element + '' }, null)
    }

    // ReactElement
    if (typeof element === 'object' && element !== null) {
      switch (element.$$typeof) {
        case REACT_ELEMENT_TYPE:
          if (before) {
            if (before.type === element.type) {
              existingChildren.delete(keyToUse)
              return useFiber(before, element.props)
            }
          }

          return createFiberFromElement(element)

        default:
          if (__DEV__) {
            console.warn('updateFromMap: unknown element type', element)
          }
          break
      }
    }

    // TODO array
    if (Array.isArray(element) && __DEV__) {
      console.warn('updateFromMap: unknown element type', element)
    }

    return null
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

      if (Array.isArray(newChild)) {
        return reconcileChildrenArray(returnFiber, currentFiber, newChild)
      }
    }

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
