import React, { useState } from 'react'
import { useAuth } from '@renderer/context/AuthProvider'
import { Input, Button, Checkbox, Alert } from 'antd'
import { AtSign, KeyRound } from 'lucide-react'
import styled from 'styled-components'

interface LoginProps {
  onSwitchToRegister: () => void
  onSuccess?: () => void
}

interface FormData {
  email: string
  password: string
  remember: boolean
}

const Login: React.FC<LoginProps> = ({ onSwitchToRegister, onSuccess }) => {
  const { login } = useAuth()
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    remember: false
  })
  const [errors, setErrors] = useState<Partial<FormData>>({})
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (field: keyof FormData) => (e: any) => {
    const value = field === 'remember' ? e.target.checked : e.target.value
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    // Clear field-specific error when user types
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {}

    if (!formData.email) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    setMessage('')

    try {
      const result = await login(formData.email, formData.password, formData.remember)

      if (result.success) {
        setMessage('')
        onSuccess?.()
      } else {
        setMessage(result.error || 'Login failed')
      }
    } catch (error) {
      setMessage('An error occurred. Please try again later.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container>
      <Title>Sign In to Symbiote Labs</Title>

      {message && (
        <Alert
          message={message}
          type="error"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      <FormContainer onSubmit={handleSubmit}>
        <FormItem>
          <Label htmlFor="email">Email</Label>
          <InputContainer>
            <StyledInput
              id="email"
              type="email"
              placeholder="Email Address"
              value={formData.email}
              onChange={handleChange('email')}
              status={errors.email ? 'error' : ''}
            />
            <AtSign className="input-icon" />
          </InputContainer>
          {errors.email && <ErrorText>{errors.email}</ErrorText>}
        </FormItem>

        <FormItem>
          <Label htmlFor="password">Password</Label>
          <InputContainer>
            <StyledInput
              id="password"
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange('password')}
              status={errors.password ? 'error' : ''}
            />
            <KeyRound className="input-icon" />
          </InputContainer>
          {errors.password && <ErrorText>{errors.password}</ErrorText>}
        </FormItem>

        <FormItem>
          <Checkbox
            checked={formData.remember}
            onChange={handleChange('remember')}
          >
            Remember me
          </Checkbox>
        </FormItem>

        <SubmitButton
          type="primary"
          htmlType="submit"
          loading={isLoading}
          block
        >
          {isLoading ? 'Signing In...' : 'Sign In'}
        </SubmitButton>
      </FormContainer>

      <FooterText>
        Don't have an account?{' '}
        <LinkText onClick={onSwitchToRegister}>
          Create an account
        </LinkText>
      </FooterText>
    </Container>
  )
}

const Container = styled.div`
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  padding: 24px;
`

const Title = styled.h2`
  text-align: center;
  margin-bottom: 24px;
  color: var(--color-text);
  font-size: 24px;
  font-weight: 600;
`

const FormContainer = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const FormItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Label = styled.label`
  font-weight: 500;
  color: var(--color-text);
  font-size: 14px;
`

const InputContainer = styled.div`
  position: relative;

  .input-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    width: 18px;
    height: 18px;
    color: var(--color-text-secondary);
    pointer-events: none;
  }
`

const StyledInput = styled(Input)`
  padding-left: 40px;
  height: 40px;
  border-radius: 6px;
  border: 1px solid var(--color-border);

  &:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
  }
`

const ErrorText = styled.span`
  color: #ff4d4f;
  font-size: 12px;
`

const SubmitButton = styled(Button)`
  height: 40px;
  margin-top: 8px;
`

const FooterText = styled.p`
  text-align: center;
  margin-top: 16px;
  color: var(--color-text-secondary);
  font-size: 14px;
`

const LinkText = styled.span`
  color: var(--color-primary);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`

export default Login