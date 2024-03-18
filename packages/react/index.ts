/*
 * @Description: React
 * @Author: Ali
 * @Date: 2024-03-06 16:29:06
 * @LastEditors: ali ali_ovo@qq.com
 * @LastEditTime: 2024-03-18 22:47:13
 */

import { Dispatcher, resolveDispatcher } from './src/currentDispatch'
import { jsx, jsxDEV, isValidElement as isValidElementFn } from './src/jsx'
import currentDispatcher from './src/currentDispatch'

export const useState: Dispatcher['useState'] = initialState => {
  const dispatcher = resolveDispatcher()

  return dispatcher.useState(initialState)
}

// 内部数据共享层
export const _SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher
}

export const version = '0.0.0'

// TODO 根据环境区分使用jsx/jsxDEV
export const createElement = jsxDEV
export const isValidElement = isValidElementFn
