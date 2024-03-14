/*
 * @Description: The return of recursion
 * @Author: Ali
 * @Date: 2024-03-08 16:41:41
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-14 15:38:08
 */

import { Container, appendInitialChild, createInstance, createTextInstance } from 'hostConfig'
import { FiberNode } from './fiber'
import { HostComponent, HostRoot, HostText } from './workTags'
import { NoFlags } from './fiberFlags'

export const completeWork = (workInProgress: FiberNode) => {
  // The return of recursion

  const newProps = workInProgress.pendingProps
  const current = workInProgress.alternate

  switch (workInProgress.tag) {
    case HostComponent:
      if (current != null && workInProgress.stateNode) {
        // 更新 DOM
      } else {
        // 构建 DOM
        const instance = createInstance(workInProgress.type, newProps)

        appendAllChildren(instance, workInProgress)
        workInProgress.stateNode = instance
      }

      bubbleProperties(workInProgress)
      return null

    case HostText:
      if (current != null && workInProgress.stateNode) {
        // 更新 DOM
      } else {
        // 构建 DOM
        const instance = createTextInstance(newProps.content)

        // 把 DOM 插入到 DOM 树中
        workInProgress.stateNode = instance
      }

      bubbleProperties(workInProgress)
      return null

    case HostRoot:
      bubbleProperties(workInProgress)

      return null
    default:
      if (__DEV__) {
        console.warn('completeWork: unknown fiber tag', workInProgress)
      }
      break
  }
}

function appendAllChildren(parent: Container, workInProgress: FiberNode) {
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
