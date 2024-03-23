/*
 * @Description: react rollup config
 * @Author: Ali
 * @Date: 2024-03-07 15:25:45
 * @LastEditors: ali ali_ovo@qq.com
 * @LastEditTime: 2024-03-23 17:04:05
 */

import { getBaseRollupPlugins, getPackageJSON, resolvePackagePath } from './utils.js'
import generatePackageJson from 'rollup-plugin-generate-package-json'
import alias from '@rollup/plugin-alias'

const { name, module, peerDependencies } = getPackageJSON('react-noop-renderer')

// react-noop-renderer package path
const pkgPath = resolvePackagePath(name)

// react-noop-renderer output path
const pkgDistPath = resolvePackagePath(name, true)

export default [
  // react-noop-renderer
  {
    input: `${pkgPath}/${module}`,
    output: [
      {
        file: `${pkgDistPath}/index.js`,
        name: 'ReactNoopRenderer',
        format: 'umd'
      }
    ],
    external: [...Object.keys(peerDependencies), 'scheduler'],
    plugins: [
      ...getBaseRollupPlugins({
        typescript: {
          exclude: ['./packages/react-dom/**/*'],
          tsconfigOverride: {
            compilerOptions: {
              paths: {
                hostConfig: [`./${name}/src/hostConfig.ts`]
              }
            }
          }
        }
      }),
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
