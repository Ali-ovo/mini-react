/*
 * @Description: ReactElement
 * @Author: Ali
 * @Date: 2024-03-06 16:49:25
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-07 17:06:15
 */

import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols'
import { ReactElementType, Key, Ref, Type, Props, ElementType } from 'shared/ReactTypes'

const ReactElement = (type: Type, key: Key, ref: Ref, props: Props) => {
  const element: ReactElementType = {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref,
    props,
    __mark: 'Ali'
  }

  return element
}

export const jsx = (type: ElementType, config: any, ...maybeChildren: any) => {
  let key: Key = null

  const props: Props = {}
  let ref: Ref = null

  for (const prop in config) {
    const val = config[prop]

    if (prop === 'key') {
      if (val != undefined) {
        key = '' + val
      }
      continue
    }

    if (key == 'ref') {
      if (val != undefined) {
        ref = val
      }

      continue
    }

    if (Object.hasOwn(config, prop)) {
      props[prop] = val
    }
  }

  const maybeChildrenLength = maybeChildren.length

  if (maybeChildrenLength) {
    if (maybeChildrenLength === 1) {
      props.children = maybeChildren[0]
    } else {
      props.children = maybeChildren
    }
  }

  return ReactElement(type, key, ref, props)
}

export const jsxDEV = (type: ElementType, config: any) => {
  let key: Key = null

  const props: Props = {}
  let ref: Ref = null

  for (const prop in config) {
    const val = config[prop]

    if (prop === 'key') {
      if (val != undefined) {
        key = '' + val
      }
      continue
    }

    if (key == 'ref') {
      if (val != undefined) {
        ref = val
      }

      continue
    }

    if (Object.hasOwn(config, prop)) {
      props[prop] = val
    }
  }

  return ReactElement(type, key, ref, props)
}