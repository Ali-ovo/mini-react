import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols'
import {
  FiberNode,
  createFiberFromElement,
  createFiberFromFragment,
  createWorkInProgress
} from './fiber'
import { Key, Props, ReactElementType } from 'shared/ReactTypes'
import { Fragment, HostText } from './workTags'
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

  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
    const key = element.key

    while (currentFiber !== null) {
      // update
      if (currentFiber.key === key) {
        // key相同
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          if (currentFiber.type === element.type) {
            let props = element.props
            if (element.type === REACT_FRAGMENT_TYPE) {
              props = element.props.children
            }
            // type相同
            const existing = useFiber(currentFiber, props)
            existing.return = returnFiber
            // 当前节点可复用，标记剩下的节点删除
            deleteRemainingChildren(returnFiber, currentFiber.sibling)
            return existing
          }

          // key相同，type不同 删掉所有旧的
          deleteRemainingChildren(returnFiber, currentFiber)
          break
        } else {
          if (__DEV__) {
            console.warn('还未实现的react类型', element)
            break
          }
        }
      } else {
        // key不同，删掉旧的
        deleteChild(returnFiber, currentFiber)

        currentFiber = currentFiber.sibling
      }
    }
    // 根据element创建fiber
    let fiber
    if (element.type === REACT_FRAGMENT_TYPE) {
      fiber = createFiberFromFragment(element.props.children, key)
    } else {
      fiber = createFiberFromElement(element)
    }
    fiber.return = returnFiber
    return fiber
  }

  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ) {
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

  function reconcileChildrenArray(
    returnFiber: FiberNode,
    currentFirstChild: FiberNode | null,
    newChild: any
  ) {
    // 最后一个可复用的 fiber 的 index
    let lastPlacedIndex = 0

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

  function getElementKeyToUse(element: any, index?: number): Key {
    if (
      Array.isArray(element) ||
      typeof element === 'string' ||
      typeof element === 'number' ||
      element === undefined ||
      element === null
    ) {
      return index
    }
    return element.key !== null ? element.key : index
  }

  function updateFromMap(
    returnFiber: FiberNode,
    existingChildren: ExistingChildren,
    index: number,
    element: any
  ): FiberNode | null {
    const keyToUse = getElementKeyToUse(element, index)
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
          if (element.type === REACT_FRAGMENT_TYPE) {
            return updateFragment(
              returnFiber,
              before,
              element.props.children,
              keyToUse,
              existingChildren
            )
          }

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

    if (Array.isArray(element)) {
      return updateFragment(returnFiber, before, element, keyToUse, existingChildren)
    }

    return null
  }

  return function reconcileChildFibers(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    newChild: any
  ) {
    // Fragment
    const isUnkeyedTopLevelFragment =
      typeof newChild === 'object' &&
      newChild !== null &&
      newChild.type === REACT_FRAGMENT_TYPE &&
      newChild.key === null

    if (isUnkeyedTopLevelFragment) {
      newChild = newChild.props.children
    }

    if (typeof newChild === 'object' && newChild !== null) {
      if (Array.isArray(newChild)) {
        return reconcileChildrenArray(returnFiber, currentFiber, newChild)
      }

      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(reconcileSingleElement(returnFiber, currentFiber, newChild))
        default:
          if (__DEV__) {
            console.warn('未实现的reconcile类型', newChild)
          }
          break
      }
    }

    // HostText
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      return placeSingleChild(reconcileSingleTextNode(returnFiber, currentFiber, newChild))
    }

    if (currentFiber !== null) {
      deleteRemainingChildren(returnFiber, currentFiber)
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

function updateFragment(
  returnFiber: FiberNode,
  current: FiberNode | undefined,
  elements: any[],
  key: Key,
  existingChildren: ExistingChildren
) {
  let fiber

  if (!current || current.tag !== Fragment) {
    fiber = createFiberFromFragment(elements, key)
  } else {
    existingChildren.delete(key)
    fiber = useFiber(current, elements)
  }

  fiber.return = returnFiber
  return fiber
}

export const reconcileChildFibers = ChildReconciler(true)
export const mountChildFibers = ChildReconciler(false)

export function cloneChildFibers(workInProgress: FiberNode) {
  // child sibling
  if (workInProgress.child === null) {
    return
  }

  let currentChild = workInProgress.child
  let newChild = createWorkInProgress(currentChild, currentChild.pendingProps)
  workInProgress.child = newChild
  newChild.return = workInProgress

  while (currentChild.sibling !== null) {
    currentChild = currentChild.sibling
    newChild = newChild.sibling = createWorkInProgress(currentChild, currentChild.pendingProps)
    newChild.return = workInProgress
  }
}
