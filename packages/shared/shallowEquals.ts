/*
 * @Description: shallowEquals
 * @Author: Ali
 * @Date: 2024-04-01 15:58:35
 * @LastEditors: Ali
 * @LastEditTime: 2024-04-01 16:10:26
 */

export function shallowEquals(a: any, b: any) {
  if (Object.is(a, b)) {
    return true
  }

  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false
  }

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) {
    return false
  }

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i]
    // b没有key、 key不想等
    if (!{}.hasOwnProperty.call(b, key) || !Object.is(a[key], b[key])) {
      return false
    }
  }

  return true
}
