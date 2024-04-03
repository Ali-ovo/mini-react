/*
 * @Description: fiber
 * @Author: Ali
 * @Date: 2024-03-19 13:12:10
 * @LastEditors: Ali
 * @LastEditTime: 2024-04-03 10:59:51
 */
import { Props, Key, Ref, ReactElementType, Wakeable } from 'shared/ReactTypes'
import {
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  MemoComponent,
  OffscreenComponent,
  SuspenseComponent,
  WorkTag
} from './workTags'
import { Flags, NoFlags } from './fiberFlags'
import { Container } from 'hostConfig'
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes'
import { Effect } from './fiberHooks'
import { CallbackNode } from 'scheduler'
import { REACT_MEMO_TYPE, REACT_PROVIDER_TYPE, REACT_SUSPENSE_TYPE } from 'shared/ReactSymbols'
import { ContextItem } from './fiberContext'

export interface OffscreenProps {
  mode: 'visible' | 'hidden'
  children: any
}

export interface PendingPassiveEffects {
  unmount: Effect[]
  update: Effect[]
}

interface FiberDependencies<Value> {
  firstContext: ContextItem<Value> | null
  lanes: Lanes
}

export class FiberNode {
  type: any
  tag: WorkTag
  pendingProps: Props
  key: Key
  stateNode: any
  ref: Ref | null

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

  lanes: Lanes
  childLanes: Lanes

  dependencies: FiberDependencies<any> | null

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    // Tag is the type of the Fiber
    this.tag = tag

    this.key = key || null

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

    this.lanes = NoLanes
    this.childLanes = NoLanes

    this.dependencies = null
  }
}

export class FiberRootNode {
  container: Container
  current: FiberNode
  finishedWork: FiberNode | null
  pendingLanes: Lanes
  finishedLane: Lane
  pendingPassiveEffects: PendingPassiveEffects

  callbackNode: CallbackNode | null
  callbackPriority: Lane

  pingCache: WeakMap<Wakeable<any>, Set<Lane>> | null
  suspendedLanes: Lanes
  pingedLanes: Lanes

  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container
    this.current = hostRootFiber
    hostRootFiber.stateNode = this
    this.finishedWork = null
    this.pendingLanes = NoLanes
    this.suspendedLanes = NoLanes
    this.pingedLanes = NoLanes

    this.finishedLane = NoLane

    this.callbackNode = null
    this.callbackPriority = NoLane

    this.pendingPassiveEffects = {
      unmount: [],
      update: []
    }

    this.pingCache = null
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

  workInProgress.lanes = current.lanes
  workInProgress.childLanes = current.childLanes

  const currentDeps = current.dependencies
  workInProgress.dependencies =
    currentDeps === null
      ? null
      : {
          lanes: currentDeps.lanes,
          firstContext: currentDeps.firstContext
        }

  return workInProgress
}

export function createFiberFromElement(element: ReactElementType): FiberNode {
  const { type, key, props, ref } = element

  let fiberTag: WorkTag = FunctionComponent

  if (typeof type === 'string') {
    fiberTag = HostComponent
  } else if (typeof type === 'object') {
    switch (type.$$typeof) {
      case REACT_PROVIDER_TYPE:
        fiberTag = ContextProvider
        break

      case REACT_MEMO_TYPE:
        fiberTag = MemoComponent
        break

      default:
        if (__DEV__) {
          console.warn('createFiberFromElement: unknown type', element)
        }
        break
    }
  } else if (type === REACT_SUSPENSE_TYPE) {
    fiberTag = SuspenseComponent
  } else if (typeof type !== 'function' && __DEV__) {
    console.warn('createFiberFromElement: unknown type', element)
  }

  const fiber = new FiberNode(fiberTag, props, key)
  fiber.type = type
  fiber.ref = ref

  return fiber
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
  const fiber = new FiberNode(Fragment, elements, key)
  return fiber
}

export function createFiberFromOffscreen(pendingProps: OffscreenProps): FiberNode {
  const fiber = new FiberNode(OffscreenComponent, pendingProps, null)
  return fiber
}
