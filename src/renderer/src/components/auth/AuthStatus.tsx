import React from 'react'
import { useAuth } from '@renderer/context/AuthProvider'
import { Card, Button, Spin, Typography, Avatar, Space } from 'antd'
import { User, LogOut, CheckCircle, XCircle } from 'lucide-react'
import styled from 'styled-components'

const { Text, Title } = Typography

const AuthStatus: React.FC = () => {
  const { user, isAuthenticated, isLoading, logout } = useAuth()

  if (isLoading) {
    return (
      <StatusCard>
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin size="large" />
          <Text style={{ marginTop: '12px', display: 'block' }}>
            Checking authentication status...
          </Text>
        </div>
      </StatusCard>
    )
  }

  return (
    <StatusCard>
      <StatusHeader>
        <Title level={4} style={{ margin: 0 }}>
          Authentication Status
        </Title>
        <StatusIcon>
          {isAuthenticated ? (
            <CheckCircle size={20} color="#52c41a" />
          ) : (
            <XCircle size={20} color="#f5222d" />
          )}
        </StatusIcon>
      </StatusHeader>

      {isAuthenticated && user ? (
        <UserInfo>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Avatar size={40} icon={<User />}>
                {user.display_name?.charAt(0) || user.email.charAt(0)}
              </Avatar>
              <div>
                <Text strong>{user.display_name || user.email}</Text>
                <br />
                <Text type="secondary">{user.email}</Text>
              </div>
            </div>

            {user.roles && user.roles.length > 0 && (
              <div>
                <Text type="secondary">Roles: {user.roles.join(', ')}</Text>
              </div>
            )}

            <Button
              icon={<LogOut size={16} />}
              onClick={logout}
              style={{ marginTop: '8px' }}
            >
              Logout
            </Button>
          </Space>
        </UserInfo>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Text type="secondary">
            Not authenticated. Please click your avatar to sign in.
          </Text>
        </div>
      )}
    </StatusCard>
  )
}

const StatusCard = styled(Card)`
  margin-bottom: 16px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
`

const StatusHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`

const StatusIcon = styled.div`
  display: flex;
  align-items: center;
`

const UserInfo = styled.div`
  background-color: var(--color-background-soft);
  padding: 16px;
  border-radius: 6px;
`

export default AuthStatus