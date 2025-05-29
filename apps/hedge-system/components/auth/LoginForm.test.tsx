import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { LoginForm } from './LoginForm'

vi.mock('aws-amplify/auth', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
  resendSignUpCode: vi.fn(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    signOut: vi.fn(),
    checkAuthState: vi.fn(),
  }),
}))

describe('LoginForm', () => {
  it('renders login form by default', () => {
    render(<LoginForm />)
    
    expect(screen.getByText('メールアドレスとパスワードを入力してログインしてください')).toBeInTheDocument()
    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
  })

  it('switches to signup mode when clicking signup link', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    
    const signupLink = screen.getByText('新規登録')
    await user.click(signupLink)
    
    expect(screen.getByText('新規登録')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '登録' })).toBeInTheDocument()
  })

  it('validates email format', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    
    const emailInput = screen.getByLabelText('メールアドレス')
    const submitButton = screen.getByRole('button', { name: 'ログイン' })
    
    await user.type(emailInput, 'invalid-email')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(emailInput).toHaveAttribute('aria-invalid', 'true')
    })
  })

  it('validates password minimum length', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    
    const emailInput = screen.getByLabelText('メールアドレス')
    const passwordInput = screen.getByLabelText('パスワード')
    const submitButton = screen.getByRole('button', { name: 'ログイン' })
    
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, '1234567')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(passwordInput).toHaveAttribute('aria-invalid', 'true')
    })
  })
})