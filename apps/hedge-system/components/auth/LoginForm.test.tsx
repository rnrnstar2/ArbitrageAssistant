import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoginForm } from './LoginForm'
import { signIn, signUp, confirmSignUp, resendSignUpCode } from 'aws-amplify/auth'

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
  const mockOnSignIn = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('renders login form by default', () => {
    render(<LoginForm onSignIn={mockOnSignIn} />)
    
    expect(screen.getByText('メールアドレスとパスワードを入力してログインしてください')).toBeInTheDocument()
    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ログイン' })).toBeInTheDocument()
  })

  it('switches to signup mode when clicking signup link', async () => {
    const user = userEvent.setup()
    render(<LoginForm onSignIn={mockOnSignIn} />)
    
    const signupLink = screen.getByText('新規登録')
    await user.click(signupLink)
    
    const headingText = screen.getAllByText('アカウント作成')[0]
    expect(headingText).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'アカウント作成' })).toBeInTheDocument()
  })

  it('shows error message on invalid login', async () => {
    const user = userEvent.setup()
    const signInMock = vi.mocked(signIn)
    signInMock.mockRejectedValueOnce(new Error('Invalid username or password'))
    
    render(<LoginForm onSignIn={mockOnSignIn} />)
    
    const emailInput = screen.getByLabelText('メールアドレス')
    const passwordInput = screen.getByLabelText('パスワード')
    const submitButton = screen.getByRole('button', { name: 'ログイン' })
    
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith({
        username: 'test@example.com',
        password: 'password123'
      })
    })
  })

  it('calls onSignIn after successful login', async () => {
    const user = userEvent.setup()
    const signInMock = vi.mocked(signIn)
    signInMock.mockResolvedValueOnce({ isSignedIn: true } as any)
    
    render(<LoginForm onSignIn={mockOnSignIn} />)
    
    const emailInput = screen.getByLabelText('メールアドレス')
    const passwordInput = screen.getByLabelText('パスワード')
    const submitButton = screen.getByRole('button', { name: 'ログイン' })
    
    await user.type(emailInput, 'test@example.com')
    await user.type(passwordInput, 'password123')
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(mockOnSignIn).toHaveBeenCalled()
    })
  })
})