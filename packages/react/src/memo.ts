/*
 * @Description: memo
 * @Author: Ali
 * @Date: 2024-04-01 15:51:53
 * @LastEditors: Ali
 * @LastEditTime: 2024-04-01 16:08:56
 */

import { Props } from 'shared/ReactTypes'
import { FiberNode } from '../../react-reconciler/src/fiber'
import { REACT_MEMO_TYPE } from 'shared/ReactSymbols'

export function memo(
  type: FiberNode['type'],
  compare?: (oldProps: Props, newProps: Props) => boolean
) {
  const fiberType = {
    $$typeof: REACT_MEMO_TYPE,
    type,
    compare: compare === undefined ? null : compare
  }

  return fiberType
}
