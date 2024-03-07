/*
 * @Description: react rollup config
 * @Author: Ali
 * @Date: 2024-03-07 15:25:45
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-07 16:17:51
 */

import { getBaseRollupPlugins, getPackageJSON, resolvePackagePath } from './utils.js'
import generatePackageJson from 'rollup-plugin-generate-package-json'

const { name, module } = getPackageJSON('react')

// react package path
const pkgPath = resolvePackagePath(name)

// react output path
const pkgDistPath = resolvePackagePath(name, true)

export default [
  // react
  {
    input: `${pkgPath}/${module}`,
    output: {
      file: `${pkgDistPath}/index.js`,
      name: 'React',
      format: 'umd'
    },
    plugins: [
      ...getBaseRollupPlugins(),
      generatePackageJson({
        inputFolder: pkgPath,
        outputFolder: pkgDistPath,
        baseContents: ({ name, description, version }) => {
          return {
            name,
            description,
            version,
            main: 'index.js'
          }
        }
      })
    ]
  },

  // jsx-runtime
  {
    input: `${pkgPath}/src/jsx.ts`,
    output: [
      // jax-runtime
      {
        file: `${pkgDistPath}/jsx-runtime.js`,
        name: 'jsx-runtime.js',
        format: 'umd'
      },

      // jsx-runtime-development
      {
        file: `${pkgDistPath}/jsx-dev-runtime.js`,
        name: 'jsx-dev-runtime.js',
        format: 'umd'
      }
    ],
    plugins: getBaseRollupPlugins()
  }
]
