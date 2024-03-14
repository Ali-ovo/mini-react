/*
 * @Description: react rollup config
 * @Author: Ali
 * @Date: 2024-03-07 15:25:45
 * @LastEditors: Ali
 * @LastEditTime: 2024-03-14 15:29:41
 */

import { getBaseRollupPlugins, getPackageJSON, resolvePackagePath } from './utils.js'
import generatePackageJson from 'rollup-plugin-generate-package-json'
import alias from '@rollup/plugin-alias'

const { name, module } = getPackageJSON('react-dom')

// react-dom package path
const pkgPath = resolvePackagePath(name)

// react-dom output path
const pkgDistPath = resolvePackagePath(name, true)

export default [
  // react-dom
  {
    input: `${pkgPath}/${module}`,
    output: [
      {
        file: `${pkgDistPath}/index.js`,
        name: 'index.js',
        format: 'umd'
      },
      {
        file: `${pkgDistPath}/client.js`,
        name: 'client.js',
        format: 'umd'
      }
    ],
    plugins: [
      ...getBaseRollupPlugins(),
      alias({
        entries: {
          hostConfig: `${pkgPath}/src/hostConfig.ts`
        }
      }),
      generatePackageJson({
        inputFolder: pkgPath,
        outputFolder: pkgDistPath,
        baseContents: ({ name, description, version }) => {
          return {
            name,
            description,
            version,
            peerDependencies: {
              react: version
            },
            main: 'index.js'
          }
        }
      })
    ]
  }
]
