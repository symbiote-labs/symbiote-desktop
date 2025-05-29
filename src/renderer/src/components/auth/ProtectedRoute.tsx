import React, { useEffect, useState } from 'react'
import { useAuth } from '@renderer/context/AuthProvider'
import { Center } from '@renderer/components/Layout'
import { Spin } from 'antd'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()
  const [authPopupShown, setAuthPopupShown] = useState(false)

  useEffect(() => {
    // Show auth popup if not authenticated and we haven't shown it yet
    if (!isLoading && !isAuthenticated && !authPopupShown) {
      setAuthPopupShown(true)
      // Dynamically import to avoid circular dependency
      import('../Popups/SymbioteUserPopup').then(module => {
        module.default.show().then(() => {
          setAuthPopupShown(false)
        })
      })
    }
  }, [isAuthenticated, isLoading, authPopupShown])

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <Center style={{ height: '100vh' }}>
        <Spin size="large" />
      </Center>
    )
  }

  // If not authenticated, show loading while auth popup handles login
  if (!isAuthenticated) {
    return (
      <Center style={{ height: '100vh' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px', color: 'var(--color-text-secondary)' }}>
          Please sign in to continue
        </div>
      </Center>
    )
  }

  // If authenticated, render the protected component
  return <>{children}</>
}

export default ProtectedRoute