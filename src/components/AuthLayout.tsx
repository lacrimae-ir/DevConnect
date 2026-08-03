import React from 'react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="auth-container">
      <div className="auth-image-section"></div>
      <div className="auth-form-section">
        <div className="auth-form-wrapper">
          {children}
        </div>
      </div>
    </div>
  );
}
