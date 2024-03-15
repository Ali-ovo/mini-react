/*
 * @Description: commit work
 * @Author: Ali
 * @Date: 2024-03-14 14:41:40
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-15 15:10:53
 */

import { Container, appendChildToContainer } from 'hostConfig'
import { FiberNode, FiberRootNode } from './fiber'
import { MutationMask, NoFlags, Placement } from './fiberFlags'
import { HostComponent, HostRoot, HostText } from './workTags'

let nextEffect: FiberNode | null = null

export const commitMutationEffects = (finishedWork: FiberNode) => {
  nextEffect = finishedWork

  while (nextEffect !== null) {
    // 向下遍历
    const child: FiberNode | null = nextEffect.child

    if ((nextEffect.subtreeFlags & MutationMask) !== NoFlags && child != null) {
      nextEffect = child
    } else {
      // 向上遍历
      up: while (nextEffect !== null) {
        commitMutationEffectsOnFiber(nextEffect)

        const sibling: FiberNode | null = nextEffect.sibling

        if (sibling != null) {
          nextEffect = sibling

          break up
        }

        nextEffect = nextEffect.return
      }
    }
  }
}

function commitMutationEffectsOnFiber(finishedWork: FiberNode) {
  const flags = finishedWork.flags

  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finishedWork)

    finishedWork.flags &= ~Placement
  }

  // flags UPdate

  // flags ChildDeletion
}

const commitPlacement = (finishedWork: FiberNode) => {
  if (__DEV__) {
    console.log('commitPlacement', finishedWork)
  }

  const hostParent = getHostParent(finishedWork)

  if (hostParent !== null) {
    appendPlacementNodeIntoContainer(finishedWork, hostParent)
  }
}

function getHostParent(fiber: FiberNode): Container | null {
  let parent = fiber.return

  while (parent) {
    const parentTag = parent.tag

    if (parentTag === HostComponent) {
      return parent.stateNode as Container
    }

    if (parentTag === HostRoot) {
      return (parent.stateNode as FiberRootNode).container
    }

    parent = parent.return
  }

  if (__DEV__) {
    console.error('Unable to find parent host component')
  }

  return null
}

function appendPlacementNodeIntoContainer(finishedWork: FiberNode, hostParent: Container) {
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    appendChildToContainer(hostParent, finishedWork.stateNode)
    return
  }

  const child = finishedWork.child

  if (child !== null) {
    appendPlacementNodeIntoContainer(child, hostParent)
    let sibling = child.sibling

    while (sibling !== null) {
      appendPlacementNodeIntoContainer(sibling, hostParent)
      sibling = sibling.sibling
    }
  }
}
