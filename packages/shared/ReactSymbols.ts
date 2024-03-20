/*
 * @Description: symbol react type
 * @Author: Ali
 * @Date: 2024-03-06 16:54:31
 * @LastEditors: ali ali_ovo@qq.com
 * @LastEditTime: 2024-03-20 22:26:55
 */

const supportSymbol = typeof Symbol === 'function' && Symbol.for

export const REACT_ELEMENT_TYPE = supportSymbol ? Symbol.for('react.element') : 0xeac7

export const REACT_FRAGMENT_TYPE = supportSymbol ? Symbol.for('react.fragment') : 0xeacb
