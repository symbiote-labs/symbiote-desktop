import React, { useState } from 'react'
import { useAuth } from '@renderer/context/AuthProvider'
import { Input, Button, Alert } from 'antd'
import { AtSign, KeyRound } from 'lucide-react'
import styled from 'styled-components'

interface RegisterProps {
  onSwitchToLogin: () => void
}

interface FormData {
  email: string
  password: string
  confirmPassword: string
}

const Register: React.FC<RegisterProps> = ({ onSwitchToLogin }) => {
  const { register } = useAuth()
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [errors, setErrors] = useState<Partial<FormData>>({})
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleChange = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
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
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long'
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
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
      const result = await register(formData.email, formData.password)

      if (result.success) {
        setIsSuccess(true)
        setMessage(result.message || 'Registration successful! Please check your email for verification instructions.')
        // Switch to login after a short delay
        setTimeout(() => {
          onSwitchToLogin()
        }, 3000)
      } else {
        setMessage(result.error || 'Registration failed. Please try again.')
      }
    } catch (error) {
      setMessage('An error occurred. Please try again later.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Container>
      <Title>Create Account</Title>

      {message && (
        <Alert
          message={message}
          type={isSuccess ? 'success' : 'error'}
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      {isSuccess ? (
        <SuccessContainer>
          <SuccessTitle>Check your email</SuccessTitle>
          <SuccessText>We've sent you instructions to complete your registration.</SuccessText>
          <Button
            type="primary"
            onClick={onSwitchToLogin}
            style={{ marginTop: '16px' }}
          >
            Go to Login
          </Button>
        </SuccessContainer>
      ) : (
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
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <InputContainer>
              <StyledInput
                id="confirmPassword"
                type="password"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange('confirmPassword')}
                status={errors.confirmPassword ? 'error' : ''}
              />
              <KeyRound className="input-icon" />
            </InputContainer>
            {errors.confirmPassword && <ErrorText>{errors.confirmPassword}</ErrorText>}
          </FormItem>

          <SubmitButton
            type="primary"
            htmlType="submit"
            loading={isLoading}
            block
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </SubmitButton>
        </FormContainer>
      )}

      <FooterText>
        Already have an account?{' '}
        <LinkText onClick={onSwitchToLogin}>
          Sign in
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

const SuccessContainer = styled.div`
  text-align: center;
  padding: 16px 0;
`

const SuccessTitle = styled.h3`
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--color-text);
`

const SuccessText = styled.p`
  margin-bottom: 16px;
  color: var(--color-text-secondary);
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

export default Register