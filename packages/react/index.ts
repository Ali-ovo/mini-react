/*
 * @Description: React
 * @Author: Ali
 * @Date: 2024-03-06 16:29:06
 * @LastEditors: ali ali_ovo@qq.com
 * @LastEditTime: 2024-03-16 18:14:29
 */

import { Dispatcher, resolveDispatcher } from './src/currentDispatch'
import { jsxDEV } from './src/jsx'
import currentDispatcher from './src/currentDispatch'

export const useState: Dispatcher['useState'] = initialState => {
  const dispatcher = resolveDispatcher()

  return dispatcher.useState(initialState)
}

// 内部数据共享层
export const _SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher
}

export default {
  version: '0.0.0',
  createElement: jsxDEV
}
