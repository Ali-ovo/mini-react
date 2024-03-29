/*
 * @Description: commit work
 * @Author: Ali
 * @Date: 2024-03-14 14:41:40
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-29 16:15:07
 */

import {
  Container,
  Instance,
  appendChildToContainer,
  commitUpdate,
  hideInstance,
  hideTextInstance,
  insertChildToContainer,
  removeChild,
  unhideInstance,
  unhideTextInstance
} from 'hostConfig'
import { FiberNode, FiberRootNode, PendingPassiveEffects } from './fiber'
import {
  ChildDeletion,
  Flags,
  LayoutMask,
  MutationMask,
  NoFlags,
  PassiveEffect,
  PassiveMask,
  Placement,
  Ref,
  Update,
  Visibility
} from './fiberFlags'
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  OffscreenComponent
} from './workTags'
import { Effect, FCUpdateQueue } from './fiberHooks'
import { HookHasEffect } from './hookEffectTags'

let nextEffect: FiberNode | null = null

export const commitEffects = (
  phrase: 'mutation' | 'layout',
  mask: Flags,
  callback: (nextEffect: FiberNode, root: FiberRootNode) => void
) => {
  return (finishedWork: FiberNode, root: FiberRootNode) => {
    nextEffect = finishedWork

    while (nextEffect !== null) {
      // 向下遍历
      const child: FiberNode | null = nextEffect.child

      if ((nextEffect.subtreeFlags & mask) !== NoFlags && child !== null) {
        nextEffect = child
      } else {
        // 向上遍历
        up: while (nextEffect !== null) {
          callback(nextEffect, root)

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
}

export const commitMutationEffects = commitEffects(
  'mutation',
  MutationMask | PassiveMask,
  commitMutationEffectsOnFiber
)

export const commitLayoutEffects = commitEffects('layout', LayoutMask, commitLayoutEffectsOnFiber)

function commitLayoutEffectsOnFiber(finishedWork: FiberNode, root: FiberRootNode) {
  const { flags, tag } = finishedWork

  if ((flags & Ref) !== NoFlags && tag === HostComponent) {
    // 绑定 ref
    safelyAttachRef(finishedWork)
    finishedWork.flags &= ~Ref
  }
}

function safelyAttachRef(fiber: FiberNode) {
  const ref = fiber.ref

  if (ref !== null) {
    const instance = fiber.stateNode
    if (typeof ref === 'function') {
      ref(instance)
    } else {
      ref.current = instance
    }
  }
}

function commitMutationEffectsOnFiber(finishedWork: FiberNode, root: FiberRootNode) {
  const { flags, tag } = finishedWork

  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finishedWork)
    finishedWork.flags &= ~Placement
  }

  // flags Update
  if ((flags & Update) !== NoFlags) {
    commitUpdate(finishedWork)
    finishedWork.flags &= ~Update
  }

  // flags ChildDeletion
  if ((flags & ChildDeletion) !== NoFlags) {
    const deletions = finishedWork.deletions
    if (deletions !== null) {
      deletions.forEach(childToDelete => {
        commitDeletion(childToDelete, root)
      })
    }

    finishedWork.flags &= ~ChildDeletion
  }

  if ((flags & PassiveEffect) !== NoFlags) {
    // 收集回调
    commitPassiveEffect(finishedWork, root, 'update')
    finishedWork.flags &= ~PassiveEffect
  }

  if ((flags & Ref) !== NoFlags && tag === HostComponent) {
    // 解绑 ref
    safelyDetachRef(finishedWork)
  }

  if ((flags & Visibility) !== NoFlags && tag === OffscreenComponent) {
    const isHidden = finishedWork.pendingProps.mode === 'hidden'
    finishedWork.flags &= ~Visibility
    hideOrUnhideAlChildren(finishedWork, isHidden)
  }
}

function hideOrUnhideAlChildren(finishedWork: FiberNode, isHidden: boolean) {
  findHostSubtreeRoot(finishedWork, hostRoot => {
    const instance = hostRoot.stateNode
    if (hostRoot.tag === HostComponent) {
      isHidden ? hideInstance(instance) : unhideInstance(instance)
    } else if (hostRoot.tag === HostText) {
      isHidden
        ? hideTextInstance(instance)
        : unhideTextInstance(instance, hostRoot.memoizedProps.content)
    }
  })
}

function findHostSubtreeRoot(
  finishedWork: FiberNode,
  callback: (hostSubtreeRoot: FiberNode) => void
) {
  let node = finishedWork
  let hostSubtreeRoot = null

  while (true) {
    if (node.tag === HostComponent) {
      if (hostSubtreeRoot === null) {
        hostSubtreeRoot = node
        callback(node)
      }
    } else if (node.tag === HostText) {
      if (hostSubtreeRoot === null) {
        callback(node)
      }
    } else if (
      node.tag === OffscreenComponent &&
      node.pendingProps.mode === 'hidden' &&
      node !== finishedWork
    ) {
      // not to do anything
    } else if (node.child !== null) {
      node.child.return = node
      node = node.child
      continue
    }

    if (node === finishedWork) {
      return
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === finishedWork) {
        return
      }

      if (hostSubtreeRoot === node) {
        hostSubtreeRoot = null
      }

      node = node.return
    }

    if (hostSubtreeRoot === node) {
      hostSubtreeRoot = null
    }

    node.sibling.return = node.return
    node = node.sibling
  }
}

function safelyDetachRef(current: FiberNode) {
  const ref = current.ref
  if (ref !== null) {
    if (typeof ref === 'function') {
      ref(null)
    } else {
      ref.current = null
    }
  }
}

function commitPassiveEffect(
  fiber: FiberNode,
  root: FiberRootNode,
  type: keyof PendingPassiveEffects
) {
  // update
  if (
    fiber.tag !== FunctionComponent ||
    (type === 'update' && (fiber.flags & PassiveEffect) === NoFlags)
  ) {
    return
  }

  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>

  if (updateQueue !== null) {
    if (updateQueue.lastEffect === null && __DEV__) {
      console.warn('commitPassiveEffect: lastEffect is null')
    }
    root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect)
  }
}

function commitHookEffectList(
  flags: Flags,
  lastEffect: Effect,
  callback: (effect: Effect) => void
) {
  let effect = lastEffect.next as Effect

  do {
    if ((effect.tag & flags) === flags) {
      callback(effect)
    }

    effect = effect.next as Effect
  } while (effect !== lastEffect.next)
}

export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, effect => {
    const destroy = effect.destroy
    if (typeof destroy === 'function') {
      destroy()
    }

    effect.tag &= ~HookHasEffect
  })
}

export function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, effect => {
    const destroy = effect.destroy
    if (typeof destroy === 'function') {
      destroy()
    }
  })
}

export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, effect => {
    const create = effect.create
    if (typeof create === 'function') {
      effect.destroy = create()
    }
  })
}

function recordHostChildrenToDelete(childrenToDelete: FiberNode[], unmountFiber: FiberNode) {
  // 找到第一个root host节点
  const lastOne = childrenToDelete[childrenToDelete.length - 1]

  if (!lastOne) {
    childrenToDelete.push(unmountFiber)
  } else {
    let node = lastOne.sibling

    while (node !== null) {
      if (unmountFiber === node) {
        childrenToDelete.push(unmountFiber)
      }

      node = node.sibling
    }
  }

  // 没找到一个 host节点 判断这个节点是不是 1
}

function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
  const rootChildrenToDelete: FiberNode[] = []

  // 递归子树
  commitNestedComponent(childToDelete, unmountFiber => {
    switch (unmountFiber.tag) {
      case HostComponent:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber)

        // 解绑 ref
        safelyDetachRef(unmountFiber)
        return

      case HostText:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber)

        return

      case FunctionComponent:
        commitPassiveEffect(unmountFiber, root, 'unmount')

        return

      default:
        if (__DEV__) {
          console.warn('commitDeletion: unknown fiber tag', unmountFiber)
        }

        break
    }
  })

  // 移除 rootHostNode
  if (rootChildrenToDelete.length) {
    const hostParent = getHostParent(childToDelete)

    if (hostParent !== null) {
      rootChildrenToDelete.forEach(node => {
        removeChild(node.stateNode, hostParent)
      })
    }
  }

  childToDelete.return = null
  childToDelete.child = null
}

function commitNestedComponent(root: FiberNode, onCommitUnmount: (fiber: FiberNode) => void) {
  let node = root

  while (true) {
    onCommitUnmount(node)

    if (node.child !== null) {
      // 向下遍历
      node.child.return = node
      node = node.child

      continue
    }

    if (node === root) {
      // 遍历完成
      return
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === root) {
        return
      }

      // 向上遍历
      node = node.return
    }

    node.sibling.return = node.return
    node = node.sibling
  }
}

const commitPlacement = (finishedWork: FiberNode) => {
  if (__DEV__) {
    console.log('commitPlacement', finishedWork)
  }

  const hostParent = getHostParent(finishedWork)

  // host sibling
  const sibling = getHostSibling(finishedWork)

  if (hostParent !== null) {
    insertOrAppendPlacementNodeIntoContainer(finishedWork, hostParent, sibling)
  }
}

function getHostSibling(fiber: FiberNode) {
  let node: FiberNode = fiber

  findSibling: while (true) {
    while (node.sibling === null) {
      const parent = node?.return

      if (parent === null || parent.tag === HostComponent || parent.tag === HostRoot) {
        return null
      }

      node = parent
    }

    node.sibling.return = node.return
    node = node.sibling

    while (node.tag !== HostText && node.tag !== HostComponent) {
      // 向下遍历
      if ((node.flags & Placement) !== NoFlags) {
        continue findSibling
      }

      if (node.child === null) {
        continue findSibling
      } else {
        node.child.return = node
        node = node.child
      }
    }

    if ((node.flags & Placement) === NoFlags) {
      return node.stateNode
    }
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

function insertOrAppendPlacementNodeIntoContainer(
  finishedWork: FiberNode,
  hostParent: Container,
  before?: Instance
) {
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    if (before) {
      insertChildToContainer(finishedWork.stateNode, hostParent, before)
    } else {
      appendChildToContainer(hostParent, finishedWork.stateNode)
    }

    return
  }

  const child = finishedWork.child

  if (child !== null) {
    insertOrAppendPlacementNodeIntoContainer(child, hostParent)
    let sibling = child.sibling

    while (sibling !== null) {
      insertOrAppendPlacementNodeIntoContainer(sibling, hostParent)
      sibling = sibling.sibling
    }
  }
}
