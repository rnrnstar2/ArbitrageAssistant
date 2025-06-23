"use client";

import { useState, useEffect } from "react";
import { LoginForm } from "./login-form";
import { SignUpForm } from "./sign-up-form";
import { ForgotPasswordForm } from "./forgot-password-form";
import { ConfirmSignUpForm } from "./confirm-sign-up-form";

type AuthStep = 'login' | 'signup' | 'forgot-password' | 'confirm-signup';

interface AuthContainerProps {
  initialStep?: AuthStep;
  loginTitle?: string;
  loginDescription?: string;
  signUpTitle?: string;
  signUpDescription?: string;
  emailPlaceholder?: string;
  className?: string;
  cardClassName?: string;
  enableSignUp?: boolean;
  enableForgotPassword?: boolean;
}

export function AuthContainer({
  initialStep = 'login',
  loginTitle,
  loginDescription,
  signUpTitle,
  signUpDescription,
  emailPlaceholder,
  className,
  cardClassName,
  enableSignUp = true,
  enableForgotPassword = true,
}: AuthContainerProps) {
  const [currentStep, setCurrentStep] = useState<AuthStep>(initialStep);
  const [confirmEmail, setConfirmEmail] = useState('');

  // URLパラメータから初期状態を設定
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      
      if (urlParams.get('signup') === '1') {
        setCurrentStep('signup');
      } else if (urlParams.get('forgot') === '1') {
        setCurrentStep('forgot-password');
      }
    }
  }, []);

  const handleSignUpSuccess = (email: string) => {
    setConfirmEmail(email);
    setCurrentStep('confirm-signup');
  };

  const handleConfirmSuccess = () => {
    setCurrentStep('login');
  };

  const handleBackToLogin = () => {
    setCurrentStep('login');
  };

  const handleGoToSignUp = () => {
    setCurrentStep('signup');
  };

  const handleGoToForgotPassword = () => {
    setCurrentStep('forgot-password');
  };

  switch (currentStep) {
    case 'signup':
      return (
        <SignUpForm
          title={signUpTitle}
          description={signUpDescription}
          onSignIn={handleBackToLogin}
          onConfirmSignUp={handleSignUpSuccess}
          className={className}
          cardClassName={cardClassName}
        />
      );

    case 'forgot-password':
      return (
        <ForgotPasswordForm
          onSignIn={handleBackToLogin}
          className={className}
          cardClassName={cardClassName}
        />
      );

    case 'confirm-signup':
      return (
        <ConfirmSignUpForm
          email={confirmEmail}
          onSignIn={handleConfirmSuccess}
          className={className}
          cardClassName={cardClassName}
        />
      );

    default:
      return (
        <LoginForm
          title={loginTitle}
          description={loginDescription}
          emailPlaceholder={emailPlaceholder}
          onSignUp={enableSignUp ? handleGoToSignUp : undefined}
          onForgotPassword={enableForgotPassword ? handleGoToForgotPassword : undefined}
          className={className}
          cardClassName={cardClassName}
        />
      );
  }
}