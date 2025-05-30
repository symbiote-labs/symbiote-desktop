import '@renderer/databases'

import store, { persistor } from '@renderer/store'
import { Provider } from 'react-redux'
import { HashRouter, Route, Routes } from 'react-router-dom'
import { PersistGate } from 'redux-persist/integration/react'
import { useSelector } from 'react-redux'

import { RootState } from '@renderer/store'
import Sidebar from './components/app/Sidebar'
import ProtectedRoute from './components/auth/ProtectedRoute'
import AutoBinaryInstaller from './components/AutoBinaryInstaller'
import { MCPInitializer } from './components/MCPInitializer'
import TopViewContainer from './components/TopView'
import AntdProvider from './context/AntdProvider'
import { AuthProvider } from './context/AuthProvider'
import { CodeStyleProvider } from './context/CodeStyleProvider'
import { NotificationProvider } from './context/NotificationProvider'
import StyleSheetManager from './context/StyleSheetManager'
import { ThemeProvider } from './context/ThemeProvider'
import NavigationHandler from './handler/NavigationHandler'
import AgentsPage from './pages/agents/AgentsPage'
import AppsPage from './pages/apps/AppsPage'
import FilesPage from './pages/files/FilesPage'
import HomePage from './pages/home/HomePage'
import KnowledgePage from './pages/knowledge/KnowledgePage'
import PaintingsRoutePage from './pages/paintings/PaintingsRoutePage'
import SettingsPage from './pages/settings/SettingsPage'
import TranslatePage from './pages/translate/TranslatePage'

function AppContent(): React.ReactElement {
  const autoInstallMCPBinaries = useSelector((state: RootState) => state.settings.autoInstallMCPBinaries)

  return (
    <StyleSheetManager>
      <ThemeProvider>
        <AntdProvider>
          <NotificationProvider>
            <CodeStyleProvider>
              <AuthProvider>
                <PersistGate loading={null} persistor={persistor}>
                  <AutoBinaryInstaller enabled={autoInstallMCPBinaries} />
                  <MCPInitializer />
                  <TopViewContainer>
                    <HashRouter>
                      <NavigationHandler />
                      <Sidebar />
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/agents" element={<AgentsPage />} />
                        <Route path="/paintings/*" element={<PaintingsRoutePage />} />
                        <Route path="/translate" element={<TranslatePage />} />
                        <Route path="/files" element={<FilesPage />} />
                        <Route path="/knowledge" element={<KnowledgePage />} />
                        <Route path="/apps" element={<AppsPage />} />
                        <Route path="/settings/*" element={
                          <ProtectedRoute>
                            <SettingsPage />
                          </ProtectedRoute>
                        } />
                      </Routes>
                    </HashRouter>
                  </TopViewContainer>
                </PersistGate>
              </AuthProvider>
            </CodeStyleProvider>
          </NotificationProvider>
        </AntdProvider>
      </ThemeProvider>
    </StyleSheetManager>
  )
}

function App(): React.ReactElement {
  return (
    <Provider store={store}>
      <AppContent />
    </Provider>
  )
}

export default App
