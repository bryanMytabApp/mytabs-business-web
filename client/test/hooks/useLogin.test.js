import { renderHook, act, waitFor } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import useLogin from '../../src/hooks/useLogin';
import * as authService from '../../src/services/authService';
import * as authUtils from '../../src/utils/authUtils';

// Mock dependencies
jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn(),
}));

jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('../../src/services/authService');
jest.mock('../../src/services/paymentService');
jest.mock('../../src/utils/common', () => ({
  parseJwt: jest.fn((token) => ({
    sub: 'user123',
    email: 'user@example.com',
  })),
}));
jest.mock('../../src/utils/authUtils');

describe('useLogin Hook - returnUrl Integration', () => {
  let mockNavigate;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate = jest.fn();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    
    // Reset window.location
    delete (window as any).location;
    (window as any).location = {
      href: 'http://keeptabs.app/login',
      search: '',
    };
    
    localStorage.clear();
  });

  describe('returnUrl detection', () => {
    it('should extract and decode returnUrl from query parameters', () => {
      const returnUrl = 'http://ticket.keeptabs.app/#/verification';
      const encodedReturnUrl = encodeURIComponent(returnUrl);
      (window as any).location.search = `?returnUrl=${encodedReturnUrl}`;

      const { result } = renderHook(() => useLogin());

      expect(result.current.returnUrl).toBe(returnUrl);
    });

    it('should handle missing returnUrl gracefully', () => {
      (window as any).location.search = '';

      const { result } = renderHook(() => useLogin());

      expect(result.current.returnUrl).toBeNull();
    });

    it('should log error when returnUrl decoding fails', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (window as any).location.search = '?returnUrl=%';

      renderHook(() => useLogin());

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to decode returnUrl:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('login success with returnUrl', () => {
    it('should validate returnUrl before redirecting', async () => {
      const returnUrl = 'http://ticket.keeptabs.app/#/verification';
      const encodedReturnUrl = encodeURIComponent(returnUrl);
      (window as any).location.search = `?returnUrl=${encodedReturnUrl}`;

      (authService.getToken as jest.Mock).mockResolvedValue({
        IdToken: 'valid-token',
        RefreshToken: 'refresh-token',
      });
      (authUtils.isValidReturnUrl as jest.Mock).mockReturnValue(true);
      (authUtils.buildAuthenticatedReturnUrl as jest.Mock).mockReturnValue(
        `${returnUrl}?token=valid-token&userId=user123`
      );

      const { result } = renderHook(() => useLogin());

      await act(async () => {
        result.current.handleUsername('testuser');
        result.current.handlePassword('password123');
        await result.current.handleLogin();
      });

      await waitFor(() => {
        expect(authUtils.isValidReturnUrl).toHaveBeenCalledWith(returnUrl);
      });
    });

    it('should redirect to dashboard when returnUrl is invalid', async () => {
      const returnUrl = 'http://evil.com/phishing';
      const encodedReturnUrl = encodeURIComponent(returnUrl);
      (window as any).location.search = `?returnUrl=${encodedReturnUrl}`;

      (authService.getToken as jest.Mock).mockResolvedValue({
        IdToken: 'valid-token',
        RefreshToken: 'refresh-token',
      });
      (authUtils.isValidReturnUrl as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useLogin());

      await act(async () => {
        result.current.handleUsername('testuser');
        result.current.handlePassword('password123');
        await result.current.handleLogin();
      });

      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith(
          'Invalid return URL - redirecting to dashboard'
        );
        expect(mockNavigate).toHaveBeenCalledWith('/admin/home');
      });
    });

    it('should append token and userId to returnUrl', async () => {
      const returnUrl = 'http://ticket.keeptabs.app/#/verification';
      const encodedReturnUrl = encodeURIComponent(returnUrl);
      (window as any).location.search = `?returnUrl=${encodedReturnUrl}`;

      (authService.getToken as jest.Mock).mockResolvedValue({
        IdToken: 'valid-token',
        RefreshToken: 'refresh-token',
      });
      (authUtils.isValidReturnUrl as jest.Mock).mockReturnValue(true);
      (authUtils.buildAuthenticatedReturnUrl as jest.Mock).mockReturnValue(
        `${returnUrl}?token=valid-token&userId=user123`
      );

      const { result } = renderHook(() => useLogin());

      await act(async () => {
        result.current.handleUsername('testuser');
        result.current.handlePassword('password123');
        await result.current.handleLogin();
      });

      await waitFor(() => {
        expect(authUtils.buildAuthenticatedReturnUrl).toHaveBeenCalledWith(
          returnUrl,
          'valid-token',
          expect.any(String)
        );
      });
    });

    it('should redirect to authenticated returnUrl', async () => {
      const returnUrl = 'http://ticket.keeptabs.app/#/verification';
      const encodedReturnUrl = encodeURIComponent(returnUrl);
      const authenticatedUrl = `${returnUrl}?token=valid-token&userId=user123`;
      (window as any).location.search = `?returnUrl=${encodedReturnUrl}`;

      (authService.getToken as jest.Mock).mockResolvedValue({
        IdToken: 'valid-token',
        RefreshToken: 'refresh-token',
      });
      (authUtils.isValidReturnUrl as jest.Mock).mockReturnValue(true);
      (authUtils.buildAuthenticatedReturnUrl as jest.Mock).mockReturnValue(
        authenticatedUrl
      );

      const { result } = renderHook(() => useLogin());

      await act(async () => {
        result.current.handleUsername('testuser');
        result.current.handlePassword('password123');
        await result.current.handleLogin();
      });

      await waitFor(() => {
        expect(window.location.href).toBe(authenticatedUrl);
      });
    });
  });

  describe('login success without returnUrl', () => {
    it('should redirect to dashboard when no returnUrl', async () => {
      (window as any).location.search = '';

      (authService.getToken as jest.Mock).mockResolvedValue({
        IdToken: 'valid-token',
        RefreshToken: 'refresh-token',
      });

      const { result } = renderHook(() => useLogin());

      await act(async () => {
        result.current.handleUsername('testuser');
        result.current.handlePassword('password123');
        await result.current.handleLogin();
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin/home');
      });
    });
  });

  describe('login failure', () => {
    it('should show error toast on login failure', async () => {
      (authService.getToken as jest.Mock).mockRejectedValue(
        new Error('Invalid credentials')
      );

      const { result } = renderHook(() => useLogin());

      await act(async () => {
        result.current.handleUsername('testuser');
        result.current.handlePassword('wrongpassword');
        await result.current.handleLogin();
      });

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid user and/or password');
      });
    });
  });
});
