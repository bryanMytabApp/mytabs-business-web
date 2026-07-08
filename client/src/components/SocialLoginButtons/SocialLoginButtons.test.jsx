import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SocialLoginButtons from "./SocialLoginButtons";

// Mock @react-oauth/google
jest.mock("@react-oauth/google", () => ({
  GoogleOAuthProvider: ({ children }) => <div data-testid="google-provider">{children}</div>,
  GoogleLogin: ({ onSuccess, onError }) => (
    <button
      data-testid="google-login-btn"
      onClick={() => onSuccess({ credential: "mock-google-credential" })}
    >
      Continue with Google
    </button>
  ),
}));

// Mock webSocialAuth
jest.mock("../../services/webSocialAuth", () => ({
  GOOGLE_CLIENT_ID: "mock-client-id",
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithFacebook: jest.fn(),
}));

const {
  signInWithGoogle,
  signInWithApple,
  signInWithFacebook,
} = require("../../services/webSocialAuth");

describe("SocialLoginButtons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders Google, Apple, and Facebook buttons", () => {
    render(<SocialLoginButtons />);
    expect(screen.getByTestId("google-login-btn")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with apple/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with facebook/i })).toBeInTheDocument();
  });

  it("does NOT render a phone/SMS button", () => {
    render(<SocialLoginButtons />);
    expect(screen.queryByRole("button", { name: /phone/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sms/i })).not.toBeInTheDocument();
  });

  it("calls onSuccess when Google sign-in succeeds", async () => {
    const mockData = { IdToken: "tok", userId: "u1", isNewUser: false };
    signInWithGoogle.mockResolvedValue(mockData);
    const onSuccess = jest.fn();

    render(<SocialLoginButtons onSuccess={onSuccess} />);
    fireEvent.click(screen.getByTestId("google-login-btn"));

    await waitFor(() => {
      expect(signInWithGoogle).toHaveBeenCalledWith("mock-google-credential");
      expect(onSuccess).toHaveBeenCalledWith(mockData);
    });
  });

  it("calls onError when Google sign-in fails", async () => {
    const error = new Error("Google failed");
    signInWithGoogle.mockRejectedValue(error);
    const onError = jest.fn();

    render(<SocialLoginButtons onError={onError} />);
    fireEvent.click(screen.getByTestId("google-login-btn"));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  it("calls onSuccess when Apple sign-in succeeds", async () => {
    const mockData = { IdToken: "tok", userId: "u2", isNewUser: true };
    signInWithApple.mockResolvedValue(mockData);
    const onSuccess = jest.fn();

    render(<SocialLoginButtons onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: /continue with apple/i }));

    await waitFor(() => {
      expect(signInWithApple).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith(mockData);
    });
  });

  it("does NOT call onError when Apple sign-in is cancelled", async () => {
    const cancelError = new Error("Apple sign-in was cancelled.");
    cancelError.code = "CANCELLED";
    signInWithApple.mockRejectedValue(cancelError);
    const onError = jest.fn();

    render(<SocialLoginButtons onError={onError} />);
    fireEvent.click(screen.getByRole("button", { name: /continue with apple/i }));

    await waitFor(() => {
      expect(signInWithApple).toHaveBeenCalled();
    });
    // Give extra time to ensure onError is NOT called
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onError).not.toHaveBeenCalled();
  });

  it("calls onSuccess when Facebook sign-in succeeds", async () => {
    const mockData = { IdToken: "tok", userId: "u3", isNewUser: false };
    signInWithFacebook.mockResolvedValue(mockData);
    const onSuccess = jest.fn();

    render(<SocialLoginButtons onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: /continue with facebook/i }));

    await waitFor(() => {
      expect(signInWithFacebook).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith(mockData);
    });
  });

  it("does NOT call onError when Facebook sign-in is cancelled", async () => {
    const cancelError = new Error("Facebook sign-in was cancelled.");
    cancelError.code = "CANCELLED";
    signInWithFacebook.mockRejectedValue(cancelError);
    const onError = jest.fn();

    render(<SocialLoginButtons onError={onError} />);
    fireEvent.click(screen.getByRole("button", { name: /continue with facebook/i }));

    await waitFor(() => {
      expect(signInWithFacebook).toHaveBeenCalled();
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onError).not.toHaveBeenCalled();
  });

  it("disables Apple and Facebook buttons when disabled prop is true", () => {
    render(<SocialLoginButtons disabled={true} />);
    expect(screen.getByRole("button", { name: /continue with apple/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /continue with facebook/i })).toBeDisabled();
  });

  it("disables buttons while an auth flow is in progress", async () => {
    // Make Apple take a while
    signInWithApple.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ IdToken: "t" }), 200))
    );

    render(<SocialLoginButtons />);
    fireEvent.click(screen.getByRole("button", { name: /continue with apple/i }));

    // While Apple is in progress, Facebook should be disabled
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /continue with facebook/i })).toBeDisabled();
    });
  });

  it("wraps content in GoogleOAuthProvider", () => {
    render(<SocialLoginButtons />);
    expect(screen.getByTestId("google-provider")).toBeInTheDocument();
  });
});
