/*
 * @Description: rollup utils
 * @Author: Ali
 * @Date: 2024-03-07 15:28:50
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-14 15:30:24
 */
import path from 'path'
import fs from 'fs'

import ts from 'rollup-plugin-typescript2'
import cjs from '@rollup/plugin-commonjs'
import replace from '@rollup/plugin-replace'

const pkgPath = path.resolve(__dirname, '../../packages')
const distPath = path.resolve(__dirname, '../../dist/node_modules')

function resolvePackagePath(pkgName, isDist) {
  if (isDist) {
    return `${distPath}/${pkgName}`
  }

  return `${pkgPath}/${pkgName}`
}

function getPackageJSON(pkgName) {
  // ... package path
  const path = `${resolvePackagePath(pkgName)}/package.json`
  const str = fs.readFileSync(path, { encoding: 'utf-8' })

  return JSON.parse(str)
}

function getBaseRollupPlugins({
  alias = {
    __DEV__: true,
    preventAssignment: true
  },
  typescript = {}
} = {}) {
  return [replace(alias), cjs(), ts(typescript)]
}

export { resolvePackagePath, getPackageJSON, getBaseRollupPlugins }
