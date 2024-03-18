import { Props, Key, Ref, ReactElementType } from 'shared/ReactTypes'
import { FunctionComponent, HostComponent, WorkTag } from './workTags'
import { Flags, NoFlags } from './fiberFlags'
import { Container } from 'hostConfig'

export class FiberNode {
  type: any
  tag: WorkTag
  pendingProps: Props
  key: Key
  stateNode: any
  ref: Ref

  return: FiberNode | null
  sibling: FiberNode | null
  child: FiberNode | null
  index: number

  memoizedProps: Props | null
  memoizedState: any
  alternate: FiberNode | null
  flags: Flags

  subtreeFlags: Flags

  updateQueue: unknown

  deletions: FiberNode[] | null

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    // Tag is the type of the Fiber
    this.tag = tag

    this.key = key

    this.stateNode = null

    this.type = null

    // father fiber
    this.return = null
    this.sibling = null
    this.child = null
    this.index = 0

    this.ref = null

    // work unit
    this.pendingProps = pendingProps
    this.memoizedProps = null
    this.updateQueue = null
    this.memoizedState = null

    this.alternate = null

    // effects
    this.flags = NoFlags
    this.subtreeFlags = NoFlags

    this.deletions = null
  }
}

export class FiberRootNode {
  container: Container
  current: FiberNode
  finishedWork: FiberNode | null

  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container
    this.current = hostRootFiber
    hostRootFiber.stateNode = this
    this.finishedWork = null
  }
}

export const createWorkInProgress = (current: FiberNode, pendingProps: Props): FiberNode => {
  let workInProgress = current.alternate

  if (workInProgress === null) {
    // mount
    workInProgress = new FiberNode(current.tag, pendingProps, current.key)
    workInProgress.type = current.type
    workInProgress.stateNode = current.stateNode

    workInProgress.alternate = current
    current.alternate = workInProgress
  } else {
    // update
    workInProgress.pendingProps = pendingProps
    workInProgress.flags = NoFlags
    workInProgress.subtreeFlags = NoFlags
    workInProgress.deletions = null
  }

  workInProgress.type = current.type
  workInProgress.updateQueue = current.updateQueue
  workInProgress.child = current.child
  workInProgress.memoizedProps = current.memoizedProps
  workInProgress.memoizedState = current.memoizedState
  workInProgress.ref = current.ref

  return workInProgress
}

export function createFiberFromElement(element: ReactElementType): FiberNode {
  const { type, key, props, ref } = element

  let fiberTag: WorkTag = FunctionComponent

  if (typeof type === 'string') {
    fiberTag = HostComponent
  } else if (typeof type !== 'function' && __DEV__) {
    console.warn('createFiberFromElement: unknown type', element)
  }

  const fiber = new FiberNode(fiberTag, props, key)
  fiber.type = type
  fiber.ref = ref

  return fiber
}
