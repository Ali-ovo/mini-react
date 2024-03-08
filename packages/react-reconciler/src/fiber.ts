import { Props, Key, Ref } from 'shared/ReactTypes'
import { WorkTag } from './workTags'
import { Flags, NoFlags } from './fiberFlags'

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
  alternate: FiberNode | null
  flags: Flags

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

    this.alternate = null

    // effects
    this.flags = NoFlags
  }
}
