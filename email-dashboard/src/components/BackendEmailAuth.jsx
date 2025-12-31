import { useState, useEffect } from 'react';
import apiService from '../services/apiService';

const BackendEmailAuth = ({ onAuthChange }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAuthStatus();
    
    // Listen for auth callback from popup
    const handleMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'GMAIL_AUTH_SUCCESS') {
        setIsAuthenticated(true);
        onAuthChange(true);
        setError(null);
      } else if (event.data.type === 'GMAIL_AUTH_ERROR') {
        setError(`Authentication failed: ${event.data.error}`);
        setIsAuthenticated(false);
        onAuthChange(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onAuthChange]);

  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      const status = await apiService.getAuthStatus();
      setIsAuthenticated(status.isAuthenticated);
      onAuthChange(status.isAuthenticated);
      setError(null);
    } catch (err) {
      console.error('Failed to check auth status:', err);
      setError('Failed to connect to server. Make sure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Get auth URL from backend
      const { authUrl } = await apiService.getAuthUrl();
      
      // Open popup for OAuth flow
      const popup = window.open(
        authUrl,
        'gmail-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Monitor popup closure
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setIsLoading(false);
          // Check auth status after popup closes
          setTimeout(checkAuthStatus, 1000);
        }
      }, 1000);

      // Cleanup timeout
      setTimeout(() => {
        clearInterval(checkClosed);
        if (!popup.closed) {
          popup.close();
        }
        setIsLoading(false);
      }, 60000); // 1 minute timeout

    } catch (err) {
      console.error('Sign in failed:', err);
      setError(`Sign in failed: ${err.message}`);
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await apiService.signOut();
      setIsAuthenticated(false);
      onAuthChange(false);
      setError(null);
    } catch (err) {
      console.error('Sign out failed:', err);
      setError('Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="auth-container">
        <div className="auth-loading">
          <div className="spinner"></div>
          <p>Connecting...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auth-container">
        <div className="auth-error">
          <h3>⚠️ Connection Error</h3>
          <p>{error}</p>
          <button onClick={checkAuthStatus}>Retry</button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-container">
        <div className="auth-signin">
          <h2>📧 Connect Your Gmail</h2>
          <p>Sign in with Google to sync your emails and see AI-powered priority rankings</p>
          <button onClick={handleSignIn} className="signin-button">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-status">
      <span className="auth-indicator">✅ Connected to Gmail</span>
      <button onClick={handleSignOut} className="signout-button">
        Sign Out
      </button>
    </div>
  );
};

export default BackendEmailAuth;