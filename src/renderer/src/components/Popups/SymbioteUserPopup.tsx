import React, { useState } from 'react'
import { Modal, Button, Avatar, Dropdown, Spin } from 'antd'
import { LogOut, User, Settings } from 'lucide-react'
import styled from 'styled-components'
import { useAuth } from '@renderer/context/AuthProvider'
import Login from '@renderer/components/auth/Login'
import Register from '@renderer/components/auth/Register'
import { TopView } from '@renderer/components/TopView'
import { Center, VStack } from '@renderer/components/Layout'

interface Props {
  resolve: (data: any) => void
}

type AuthView = 'login' | 'register'

const PopupContainer: React.FC<Props> = ({ resolve }) => {
  const [open, setOpen] = useState(true)
  const [currentView, setCurrentView] = useState<AuthView>('login')
  const { user, isAuthenticated, isLoading, logout } = useAuth()

  const onClose = () => {
    setOpen(false)
  }

  const afterClose = () => {
    resolve({})
  }

  const handleAuthSuccess = () => {
    setOpen(false)
  }

  const handleLogout = async () => {
    await logout()
    setOpen(false)
  }

  const handleSwitchToRegister = () => {
    setCurrentView('register')
  }

  const handleSwitchToLogin = () => {
    setCurrentView('login')
  }

  // If loading, show spinner
  if (isLoading) {
    return (
      <Modal
        width="400px"
        open={open}
        footer={null}
        onCancel={onClose}
        afterClose={afterClose}
        transitionName="animation-move-down"
        centered
      >
        <Center style={{ padding: '40px' }}>
          <Spin size="large" />
        </Center>
      </Modal>
    )
  }

  // If authenticated, show user info and logout option
  if (isAuthenticated && user) {
    const userMenuItems = [
      {
        key: 'profile',
        label: 'Profile',
        icon: <User size={16} />,
        onClick: () => {
          // Could open profile settings
          console.log('Profile clicked')
        }
      },
      {
        key: 'settings',
        label: 'Settings',
        icon: <Settings size={16} />,
        onClick: () => {
          // Could open app settings
          console.log('Settings clicked')
        }
      },
      {
        type: 'divider' as const
      },
      {
        key: 'logout',
        label: 'Logout',
        icon: <LogOut size={16} />,
        onClick: handleLogout
      }
    ]

    return (
      <Modal
        width="400px"
        open={open}
        footer={null}
        onCancel={onClose}
        afterClose={afterClose}
        transitionName="animation-move-down"
        centered
      >
        <UserContainer>
          <VStack alignItems="center" gap="16px">
            <Avatar size={80} src={undefined}>
              {user.display_name?.charAt(0) || user.email.charAt(0)}
            </Avatar>
            <UserInfo>
              <UserName>{user.display_name || user.email}</UserName>
              <UserEmail>{user.email}</UserEmail>
              {user.roles && user.roles.length > 0 && (
                <UserRoles>Roles: {user.roles.join(', ')}</UserRoles>
              )}
            </UserInfo>
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottom">
              <Button type="primary" style={{ width: '200px' }}>
                Account Options
              </Button>
            </Dropdown>
          </VStack>
        </UserContainer>
      </Modal>
    )
  }

  // If not authenticated, show login/register forms
  return (
    <Modal
      width="500px"
      open={open}
      footer={null}
      onCancel={onClose}
      afterClose={afterClose}
      transitionName="animation-move-down"
      centered
    >
      {currentView === 'login' ? (
        <Login
          onSwitchToRegister={handleSwitchToRegister}
          onSuccess={handleAuthSuccess}
        />
      ) : (
        <Register
          onSwitchToLogin={handleSwitchToLogin}
        />
      )}
    </Modal>
  )
}

const UserContainer = styled.div`
  padding: 24px;
  text-align: center;
`

const UserInfo = styled.div`
  text-align: center;
`

const UserName = styled.h3`
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
`

const UserEmail = styled.p`
  margin: 0 0 8px 0;
  font-size: 14px;
  color: var(--color-text-secondary);
`

const UserRoles = styled.p`
  margin: 0;
  font-size: 12px;
  color: var(--color-text-tertiary);
  padding: 4px 8px;
  background-color: var(--color-background-soft);
  border-radius: 12px;
  display: inline-block;
`

export default class SymbioteUserPopup {
  static topviewId = 0

  static hide() {
    TopView.hide('SymbioteUserPopup')
  }

  static show() {
    return new Promise<any>((resolve) => {
      TopView.show(
        <PopupContainer
          resolve={(v) => {
            resolve(v)
            this.hide()
          }}
        />,
        'SymbioteUserPopup'
      )
    })
  }
}