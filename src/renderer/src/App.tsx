import '@renderer/databases'

import store, { persistor } from '@renderer/store'
import { Provider } from 'react-redux'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { PersistGate } from 'redux-persist/integration/react'

import Sidebar from './components/app/Sidebar'
import DeepClaudeProvider from './components/DeepClaudeProvider'
import MemoryProvider from './components/MemoryProvider'
import PDFSettingsInitializer from './components/PDFSettingsInitializer'
import WorkspaceInitializer from './components/WorkspaceInitializer'
import TopViewContainer from './components/TopView'
import AntdProvider from './context/AntdProvider'
import StyleSheetManager from './context/StyleSheetManager'
import { SyntaxHighlighterProvider } from './context/SyntaxHighlighterProvider'
import { ThemeProvider } from './context/ThemeProvider'
import NavigationHandler from './handler/NavigationHandler'
import AgentsPage from './pages/agents/AgentsPage'
import AppsPage from './pages/apps/AppsPage'
import FilesPage from './pages/files/FilesPage'
import HomePage from './pages/home/HomePage'
import KnowledgePage from './pages/knowledge/KnowledgePage'
import PaintingsPage from './pages/paintings/PaintingsPage'
import SettingsPage from './pages/settings/SettingsPage'
import TranslatePage from './pages/translate/TranslatePage'
import WorkspacePage from './pages/workspace'

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
                  <WorkspaceInitializer />
                  <TopViewContainer>
                    <HashRouter>
                      <NavigationHandler />
                      <Sidebar />
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/agents" element={<AgentsPage />} />
                        <Route path="/paintings" element={<PaintingsPage />} />
                        <Route path="/translate" element={<TranslatePage />} />
                        <Route path="/files" element={<FilesPage />} />
                        <Route path="/knowledge" element={<KnowledgePage />} />
                        <Route path="/apps" element={<AppsPage />} />
                        <Route path="/workspace" element={<WorkspacePage />} />
                        <Route path="/settings/*" element={<SettingsPage />} />
                      </Routes>
                    </HashRouter>
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
