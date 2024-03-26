/*
 * @Description: React
 * @Author: Ali
 * @Date: 2024-03-06 16:29:06
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-26 14:37:43
 */

import { Dispatcher, resolveDispatcher } from './src/currentDispatch'
import { jsx, jsxDEV, isValidElement as isValidElementFn } from './src/jsx'
import currentDispatcher from './src/currentDispatch'
import currentBatchConfig from './src/currentBatchConfig'

export const useState: Dispatcher['useState'] = initialState => {
  const dispatcher = resolveDispatcher()

  return dispatcher.useState(initialState)
}

export const useEffect: Dispatcher['useEffect'] = (create, deps) => {
  const dispatcher = resolveDispatcher()

  return dispatcher.useEffect(create, deps)
}

export const useTransition: Dispatcher['useTransition'] = () => {
  const dispatcher = resolveDispatcher()

  return dispatcher.useTransition()
}

// 内部数据共享层
export const _SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher,
  currentBatchConfig
}

export const version = '0.0.0'

// TODO 根据环境区分使用jsx/jsxDEV
export const createElement = jsxDEV
export const isValidElement = isValidElementFn
