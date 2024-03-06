/*
 * @Description: symbol react type
 * @Author: Ali
 * @Date: 2024-03-06 16:54:31
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-06 16:56:01
 */

const supportSymbol = typeof Symbol === 'function' && Symbol.for

export const REACT_ELEMENT_TYPE = supportSymbol ? Symbol.for('react.element') : 0xeac7
