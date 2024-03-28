/*
 * @Description: The return of recursion
 * @Author: Ali
 * @Date: 2024-03-08 16:41:41
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-28 15:06:14
 */

import {
  Container,
  Instance,
  appendInitialChild,
  createInstance,
  createTextInstance
} from 'hostConfig'
import { FiberNode } from './fiber'
import {
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText
} from './workTags'
import { NoFlags, Ref, Update } from './fiberFlags'
import { popProvider } from './fiberContext'

function markUpdate(fiber: FiberNode) {
  fiber.flags |= Update
}

function markRef(fiber: FiberNode) {
  fiber.flags |= Ref
}

export const completeWork = (workInProgress: FiberNode) => {
  // The return of recursion

  const newProps = workInProgress.pendingProps
  const current = workInProgress.alternate

  switch (workInProgress.tag) {
    case HostComponent:
      if (current != null && workInProgress.stateNode) {
        // update
        // props 是否变化
        // updateFiberProps(workInProgress.stateNode, newProps)
        markUpdate(workInProgress)

        if (current.ref !== workInProgress.ref) {
          markRef(workInProgress)
        }
      } else {
        //  mount 构建 DOM
        const instance = createInstance(workInProgress.type, newProps)

        appendAllChildren(instance, workInProgress)
        workInProgress.stateNode = instance

        // 标记 ref
        if (workInProgress.ref !== null) {
          markRef(workInProgress)
        }
      }

      bubbleProperties(workInProgress)
      return null

    case HostText:
      if (current != null && workInProgress.stateNode) {
        // update
        const oldText = current.memoizedProps?.content
        const newText = newProps.content
        if (oldText !== newText) {
          markUpdate(workInProgress)
        }
      } else {
        // 构建 DOM
        const instance = createTextInstance(newProps.content)

        // 把 DOM 插入到 DOM 树中
        workInProgress.stateNode = instance
      }

      bubbleProperties(workInProgress)
      return null

    case HostRoot:
    case FunctionComponent:
    case Fragment:
      bubbleProperties(workInProgress)
      return null

    case ContextProvider:
      const context = workInProgress.type._context
      popProvider(context)
      bubbleProperties(workInProgress)
      return null

    default:
      if (__DEV__) {
        console.warn('completeWork: unknown fiber tag', workInProgress)
      }
      break
  }
}

function appendAllChildren(parent: Container | Instance, workInProgress: FiberNode) {
  let node = workInProgress.child

  while (node !== null) {
    if (node.tag === HostComponent || node.tag === HostText) {
      appendInitialChild(parent, node?.stateNode)
    } else if (node.child !== null) {
      node.child.return = node
      node = node.child
      continue
    }

    if (node === workInProgress) {
      return
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === workInProgress) {
        return
      }
      node = node?.return
    }
    node.sibling.return = node.return
    node = node.sibling
  }
}

function bubbleProperties(workInProgress: FiberNode) {
  let subtreeFlags = NoFlags
  let child = workInProgress.child

  while (child !== null) {
    subtreeFlags |= child.subtreeFlags
    subtreeFlags |= child.flags

    child.return = workInProgress
    child = child.sibling
  }

  workInProgress.subtreeFlags |= subtreeFlags
}
