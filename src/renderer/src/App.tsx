import '@renderer/databases'

import store, { persistor } from '@renderer/store'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'

import DeepClaudeProvider from './components/DeepClaudeProvider'
import MemoryProvider from './components/MemoryProvider'
import PDFSettingsInitializer from './components/PDFSettingsInitializer'
import WebSearchInitializer from './components/WebSearchInitializer'
import WorkspaceInitializer from './components/WorkspaceInitializer'
import TopViewContainer from './components/TopView'
import AntdProvider from './context/AntdProvider'
import StyleSheetManager from './context/StyleSheetManager'
import { SyntaxHighlighterProvider } from './context/SyntaxHighlighterProvider'
import { ThemeProvider } from './context/ThemeProvider'
import RouterComponent from './router/RouterConfig'

function App(): React.ReactElement {
  return (
    <Provider store={store}>
      <StyleSheetManager>
        <ThemeProvider>
          <AntdProvider>
            <SyntaxHighlighterProvider>
              <PersistGate loading={null} persistor={persistor}>
                <MemoryProvider>
                  <DeepClaudeProvider />
                  <PDFSettingsInitializer />
                  <WebSearchInitializer />
                  <WorkspaceInitializer />
                  <TopViewContainer>
                    <RouterComponent />
                  </TopViewContainer>
                </MemoryProvider>
              </PersistGate>
            </SyntaxHighlighterProvider>
          </AntdProvider>
        </ThemeProvider>
      </StyleSheetManager>
    </Provider>
  )
}

export default App
