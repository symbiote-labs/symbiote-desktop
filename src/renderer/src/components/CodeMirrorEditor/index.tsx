import './styles.css'
import './ChineseSearchPanel.css'

import { autocompletion } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from '@codemirror/commands'
import { cpp } from '@codemirror/lang-cpp'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { java } from '@codemirror/lang-java'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { php } from '@codemirror/lang-php'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { sql } from '@codemirror/lang-sql'
import { vue } from '@codemirror/lang-vue'
import { xml } from '@codemirror/lang-xml'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { searchKeymap } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useSettings } from '@renderer/hooks/useSettings'
import { CodeStyleVarious, ThemeMode } from '@renderer/types'
import { useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import styled from 'styled-components'

import { createChineseSearchPanel, openChineseSearchPanel } from './ChineseSearchPanel'

// 自定义语法高亮样式
const lightThemeHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#0000ff' },
  { tag: tags.comment, color: '#008000', fontStyle: 'italic' },
  { tag: tags.string, color: '#a31515' },
  { tag: tags.number, color: '#098658' },
  { tag: tags.operator, color: '#000000' },
  { tag: tags.variableName, color: '#001080' },
  { tag: tags.propertyName, color: '#001080' },
  { tag: tags.className, color: '#267f99' },
  { tag: tags.typeName, color: '#267f99' },
  { tag: tags.definition(tags.variableName), color: '#001080' },
  { tag: tags.definition(tags.propertyName), color: '#001080' },
  { tag: tags.definition(tags.className), color: '#267f99' },
  { tag: tags.definition(tags.typeName), color: '#267f99' },
  { tag: tags.function(tags.variableName), color: '#795e26' },
  { tag: tags.function(tags.propertyName), color: '#795e26' },
  { tag: tags.angleBracket, color: '#800000' },
  { tag: tags.tagName, color: '#800000' },
  { tag: tags.attributeName, color: '#ff0000' },
  { tag: tags.attributeValue, color: '#0000ff' },
  { tag: tags.heading, color: '#800000', fontWeight: 'bold' },
  { tag: tags.link, color: '#0000ff', textDecoration: 'underline' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' }
])

// 暗色主题语法高亮样式
const darkThemeHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: '#569cd6' },
  { tag: tags.comment, color: '#6a9955', fontStyle: 'italic' },
  { tag: tags.string, color: '#ce9178' },
  { tag: tags.number, color: '#b5cea8' },
  { tag: tags.operator, color: '#d4d4d4' },
  { tag: tags.variableName, color: '#9cdcfe' },
  { tag: tags.propertyName, color: '#9cdcfe' },
  { tag: tags.className, color: '#4ec9b0' },
  { tag: tags.typeName, color: '#4ec9b0' },
  { tag: tags.definition(tags.variableName), color: '#9cdcfe' },
  { tag: tags.definition(tags.propertyName), color: '#9cdcfe' },
  { tag: tags.definition(tags.className), color: '#4ec9b0' },
  { tag: tags.definition(tags.typeName), color: '#4ec9b0' },
  { tag: tags.function(tags.variableName), color: '#dcdcaa' },
  { tag: tags.function(tags.propertyName), color: '#dcdcaa' },
  { tag: tags.angleBracket, color: '#808080' },
  { tag: tags.tagName, color: '#569cd6' },
  { tag: tags.attributeName, color: '#9cdcfe' },
  { tag: tags.attributeValue, color: '#ce9178' },
  { tag: tags.heading, color: '#569cd6', fontWeight: 'bold' },
  { tag: tags.link, color: '#569cd6', textDecoration: 'underline' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' }
])

export interface CodeMirrorEditorRef {
  undo: () => boolean
  redo: () => boolean
  openSearch: () => void
  getContent: () => string
}

interface CodeMirrorEditorProps {
  code: string
  language: string
  onChange?: (value: string) => void
  readOnly?: boolean
  showLineNumbers?: boolean
  fontSize?: number
  height?: string
}

// 获取CodeMirror主题扩展
const getThemeExtension = (codeStyle: CodeStyleVarious, isDarkMode: boolean) => {
  // 目前只支持 oneDark 主题，其他主题需要安装相应的包
  // 如果是暗色模式且是 auto 或特定主题，则使用 oneDark 主题
  if (isDarkMode && (codeStyle === 'auto' || String(codeStyle) === 'one-dark')) {
    return oneDark
  }

  // 其他情况返回 null，使用默认主题
  return null
}

const getLanguageExtension = (language: string) => {
  switch (language.toLowerCase()) {
    case 'javascript':
    case 'js':
    case 'jsx':
    case 'typescript':
    case 'ts':
    case 'tsx':
      return javascript()
    case 'python':
    case 'py':
      return python()
    case 'html':
      return html()
    case 'css':
    case 'scss':
    case 'less':
      return css()
    case 'json':
      return json()
    case 'markdown':
    case 'md':
      return markdown()
    case 'cpp':
    case 'c':
    case 'c++':
    case 'h':
    case 'hpp':
      return cpp()
    case 'java':
      return java()
    case 'php':
      return php()
    case 'rust':
    case 'rs':
      return rust()
    case 'sql':
      return sql()
    case 'xml':
    case 'svg':
      return xml()
    case 'vue':
      return vue()
    default:
      return javascript()
  }
}

const CodeMirrorEditor = ({
  ref,
  code,
  language,
  onChange,
  readOnly = false,
  showLineNumbers = true,
  fontSize = 14,
  height = 'auto'
}: CodeMirrorEditorProps & { ref?: React.RefObject<CodeMirrorEditorRef | null> }) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const { theme } = useTheme()
  const { codeStyle } = useSettings()

  // 根据当前主题和代码风格选择高亮样式
  const highlightStyle = useMemo(() => {
    // 如果代码风格设置为auto或未设置，则根据主题选择默认样式
    if (!codeStyle || codeStyle === 'auto') {
      return theme === ThemeMode.dark ? darkThemeHighlightStyle : lightThemeHighlightStyle
    }

    // 目前仍使用默认样式，因为需要为每种代码风格创建对应的CodeMirror高亮样式
    // 这里可以根据codeStyle的值选择不同的高亮样式
    // 未来可以扩展更多的主题支持
    return theme === ThemeMode.dark ? darkThemeHighlightStyle : lightThemeHighlightStyle
  }, [theme, codeStyle])

  // 暴露撤销/重做方法和获取内容方法
  useImperativeHandle(ref, () => ({
    undo: () => {
      if (editorViewRef.current) {
        try {
          // 使用用户事件标记来触发撤销
          const success = undo({ state: editorViewRef.current.state, dispatch: editorViewRef.current.dispatch })
          // 返回是否成功撤销
          return success
        } catch (error) {
          return false
        }
      }
      return false
    },
    redo: () => {
      if (editorViewRef.current) {
        try {
          // 使用用户事件标记来触发重做
          const success = redo({ state: editorViewRef.current.state, dispatch: editorViewRef.current.dispatch })
          // 返回是否成功重做
          return success
        } catch (error) {
          return false
        }
      }
      return false
    },
    openSearch: () => {
      if (editorViewRef.current) {
        openChineseSearchPanel(editorViewRef.current)
      }
    },
    // 获取当前编辑器内容
    getContent: () => {
      if (editorViewRef.current) {
        return editorViewRef.current.state.doc.toString()
      }
      return code
    }
  }))

  useEffect(() => {
    if (!editorRef.current) return

    // 清除之前的编辑器实例
    if (editorViewRef.current) {
      editorViewRef.current.destroy()
    }

    const languageExtension = getLanguageExtension(language)

    // 监听编辑器所有更新
    const updateListener = EditorView.updateListener.of((update) => {
      // 当文档变化时更新内部状态
      if (update.docChanged) {
        // 检查是否是撤销/重做操作
        const isUndoRedo = update.transactions.some((tr) => tr.isUserEvent('undo') || tr.isUserEvent('redo'))

        // 记录所有文档变化，但只在撤销/重做时触发 onChange
        if (isUndoRedo && onChange) {
          // 如果是撤销/重做操作，则触发 onChange
          onChange(update.state.doc.toString())
        }
      }
    })

    const extensions = [
      // 配置历史记录
      history(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab,
        { key: 'Mod-z', run: undo },
        { key: 'Mod-y', run: redo },
        { key: 'Mod-Shift-z', run: redo }
      ]),
      syntaxHighlighting(highlightStyle),
      languageExtension,
      EditorView.editable.of(!readOnly),
      updateListener,
      EditorState.readOnly.of(readOnly),
      highlightActiveLine(),
      autocompletion(),
      createChineseSearchPanel(),
      EditorView.theme({
        '&': {
          fontSize: `${fontSize}px`,
          height: height
        },
        '.cm-content': {
          fontFamily: 'monospace'
        }
      })
    ]

    // 添加行号
    if (showLineNumbers) {
      extensions.push(lineNumbers())
    }

    // 添加主题
    const themeExtension = getThemeExtension(codeStyle, theme === ThemeMode.dark)
    if (themeExtension) {
      extensions.push(themeExtension)
    }

    const state = EditorState.create({
      doc: code,
      extensions
    })

    const view = new EditorView({
      state,
      parent: editorRef.current
    })

    editorViewRef.current = view

    return () => {
      view.destroy()
    }
  }, [code, language, onChange, readOnly, showLineNumbers, theme, codeStyle, highlightStyle, fontSize, height])

  return <EditorContainer ref={editorRef} />
}

const EditorContainer = styled.div`
  width: 100%;
  border-radius: 4px;
  overflow: hidden;

  .cm-editor {
    height: 100%;
  }

  .cm-scroller {
    overflow: auto;
  }
`

export default CodeMirrorEditor
