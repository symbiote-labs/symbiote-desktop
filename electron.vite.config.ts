import { sentryVitePlugin } from '@sentry/vite-plugin'
import react from '@vitejs/plugin-react-swc'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

const visualizerPlugin = (type: 'renderer' | 'main') => {
  return process.env[`VISUALIZER_${type.toUpperCase()}`] ? [visualizer({ open: true })] : []
}

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          '@cherrystudio/embedjs',
          '@cherrystudio/embedjs-openai',
          '@cherrystudio/embedjs-loader-web',
          '@cherrystudio/embedjs-loader-markdown',
          '@cherrystudio/embedjs-loader-msoffice',
          '@cherrystudio/embedjs-loader-xml',
          '@cherrystudio/embedjs-loader-pdf',
          '@cherrystudio/embedjs-loader-sitemap',
          '@cherrystudio/embedjs-libsql',
          '@cherrystudio/embedjs-loader-image',
          'p-queue',
          'webdav'
        ]
      }),
      ...visualizerPlugin('main')
    ],
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@types': resolve('src/renderer/src/types'),
        '@shared': resolve('packages/shared')
      }
    },
    build: {
      rollupOptions: {
        external: ['@libsql/client']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('packages/shared')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          'browser-preload': resolve('src/preload/browser-preload.js')
        }
      }
    }
  },
  renderer: {
    plugins: [
      react({
        plugins: [
          [
            '@swc/plugin-styled-components',
            {
              displayName: process.env.NODE_ENV === 'development', // 仅在开发环境下启用组件名称
              fileName: false, // 不在类名中包含文件名
              pure: true, // 优化性能
              ssr: false // 不需要服务端渲染
            }
          ]
        ]
      }),
      // 仅在非CI环境下启用Sentry插件
      ...(process.env.CI
        ? []
        : [
            sentryVitePlugin({
              authToken: process.env.SENTRY_AUTH_TOKEN
            })
          ]),
      ...visualizerPlugin('renderer')
    ],
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('packages/shared')
      }
    },
    // optimizeDeps 配置已移至下方
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html')
        },
        // 减少打包时的警告输出
        onwarn(warning, warn) {
          // 忽略某些警告
          if (warning.code === 'CIRCULAR_DEPENDENCY') return
          warn(warning)
        }
      },
      // 复制ASR服务器文件
      assetsInlineLimit: 0,
      // 确保复制assets目录下的所有文件
      copyPublicDir: true,
      // 启用构建缓存
      commonjsOptions: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        // 提高CommonJS模块转换性能
        transformMixedEsModules: true
      }
    },
    // 启用依赖预构建缓存
    optimizeDeps: {
      // 强制预构建这些依赖
      include: ['react', 'react-dom', 'styled-components', 'antd', 'lodash'],
      // 启用缓存
      disabled: false
    }
  }
})
