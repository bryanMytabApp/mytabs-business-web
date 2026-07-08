import { signInWithApple, APPLE_CLIENT_ID, signInWithFacebook, FACEBOOK_APP_ID, signInWithGoogle, GOOGLE_CLIENT_ID } from "./webSocialAuth";

// Mock the http module
jest.mock("../utils/axios/http", () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

import http from "../utils/axios/http";

describe("signInWithApple", () => {
  let localStorageMock;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key, value) => {
        localStorageMock[key] = value;
      }
    );
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key) => localStorageMock[key] || null
    );

    // Reset mocks
    jest.clearAllMocks();

    // Remove any existing Apple SDK mock
    delete window.AppleID;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockAppleResponse = {
    authorization: {
      id_token: "mock.apple.id_token.jwt",
      code: "mock_auth_code",
      user: "apple_user_001",
    },
    user: {
      name: { firstName: "John", lastName: "Doe" },
      email: "john@icloud.com",
    },
  };

  const mockBackendResponse = {
    data: {
      IdToken: "cognito-id-token",
      AccessToken: "cognito-access-token",
      RefreshToken: "cognito-refresh-token",
      userId: "user-123",
      user: { email: "john@icloud.com", firstName: "John", lastName: "Doe" },
      isNewUser: true,
    },
  };

  function setupAppleSDKMock(signInResult) {
    window.AppleID = {
      auth: {
        init: jest.fn(),
        signIn: jest.fn().mockResolvedValue(signInResult),
      },
    };
  }

  it("should call Apple SDK init with correct config and return backend data on success", async () => {
    setupAppleSDKMock(mockAppleResponse);
    http.post.mockResolvedValue(mockBackendResponse);

    const result = await signInWithApple();

    // Verify SDK was initialized correctly
    expect(window.AppleID.auth.init).toHaveBeenCalledWith({
      clientId: APPLE_CLIENT_ID,
      scope: "name email",
      redirectURI: "https://keeptabs.app/auth/apple/callback",
      usePopup: true,
    });

    // Verify backend was called with correct payload
    expect(http.post).toHaveBeenCalledWith("authWeb/social-auth", {
      provider: "apple",
      idToken: "mock.apple.id_token.jwt",
      appleUser: "apple_user_001",
      fullName: { givenName: "John", familyName: "Doe" },
    });

    // Verify tokens stored in localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "idToken",
      "cognito-id-token"
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "accessToken",
      "cognito-access-token"
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "refToken",
      "cognito-refresh-token"
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "username",
      "john@icloud.com"
    );

    // Verify return value
    expect(result).toEqual(mockBackendResponse.data);
  });

  it("should handle returning user (no user info in Apple response)", async () => {
    const returningUserResponse = {
      authorization: {
        id_token: "mock.apple.id_token.jwt",
        code: "mock_auth_code",
      },
      // No user object on subsequent sign-ins
    };

    setupAppleSDKMock(returningUserResponse);
    http.post.mockResolvedValue(mockBackendResponse);

    await signInWithApple();

    // Should NOT include appleUser or fullName for returning users
    expect(http.post).toHaveBeenCalledWith("authWeb/social-auth", {
      provider: "apple",
      idToken: "mock.apple.id_token.jwt",
    });
  });

  it("should throw CANCELLED error when user closes popup", async () => {
    setupAppleSDKMock(null);
    window.AppleID.auth.signIn.mockRejectedValue({
      error: "popup_closed_by_user",
    });

    await expect(signInWithApple()).rejects.toMatchObject({
      message: "Apple sign-in was cancelled.",
      code: "CANCELLED",
    });

    // Backend should NOT have been called
    expect(http.post).not.toHaveBeenCalled();
  });

  it("should throw enhanced error on backend failure", async () => {
    setupAppleSDKMock(mockAppleResponse);
    http.post.mockRejectedValue({
      response: {
        status: 401,
        data: { error: "Token verification failed." },
      },
    });

    await expect(signInWithApple()).rejects.toMatchObject({
      message: "Token verification failed.",
      status: 401,
    });
  });

  it("should throw error when no id_token in Apple response", async () => {
    const noTokenResponse = {
      authorization: { code: "mock_auth_code" },
      // No id_token
    };
    setupAppleSDKMock(noTokenResponse);

    await expect(signInWithApple()).rejects.toMatchObject({
      message: "No identity token received from Apple.",
    });

    expect(http.post).not.toHaveBeenCalled();
  });

  it("should load Apple SDK dynamically if not already present", async () => {
    // Don't set window.AppleID — force SDK loading path
    const appendChildSpy = jest.spyOn(document.head, "appendChild");

    // We'll simulate the script loading by intercepting appendChild
    appendChildSpy.mockImplementation((script) => {
      // Simulate script load: set window.AppleID then fire onload
      window.AppleID = {
        auth: {
          init: jest.fn(),
          signIn: jest.fn().mockResolvedValue(mockAppleResponse),
        },
      };
      script.onload();
    });

    http.post.mockResolvedValue(mockBackendResponse);

    await signInWithApple();

    // Verify script was appended
    expect(appendChildSpy).toHaveBeenCalled();
    const script = appendChildSpy.mock.calls[0][0];
    expect(script.src).toBe(
      "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"
    );

    appendChildSpy.mockRestore();
  });

  it("should throw error when SDK fails to load", async () => {
    const appendChildSpy = jest.spyOn(document.head, "appendChild");
    appendChildSpy.mockImplementation((script) => {
      script.onerror();
    });

    await expect(signInWithApple()).rejects.toMatchObject({
      message: "Failed to load Apple Sign-In SDK.",
    });

    appendChildSpy.mockRestore();
  });
});


describe("signInWithFacebook", () => {
  let localStorageMock;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key, value) => {
        localStorageMock[key] = value;
      }
    );
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key) => localStorageMock[key] || null
    );

    // Reset mocks
    jest.clearAllMocks();

    // Remove any existing Facebook SDK mock
    delete window.FB;
    delete window.fbAsyncInit;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockBackendResponse = {
    data: {
      IdToken: "cognito-id-token",
      AccessToken: "cognito-access-token",
      RefreshToken: "cognito-refresh-token",
      userId: "user-456",
      user: { email: "jane@facebook.com", firstName: "Jane", lastName: "Smith" },
      isNewUser: false,
    },
  };

  function setupFBSDKMock(loginResponse) {
    window.FB = {
      init: jest.fn(),
      login: jest.fn((callback, options) => {
        callback(loginResponse);
      }),
    };
  }

  it("should call FB.login with correct scope and return backend data on success", async () => {
    const fbLoginResponse = {
      status: "connected",
      authResponse: {
        accessToken: "fb-access-token-123",
        userID: "fb-user-001",
      },
    };

    setupFBSDKMock(fbLoginResponse);
    http.post.mockResolvedValue(mockBackendResponse);

    const result = await signInWithFacebook();

    // Verify FB.login was called with correct scope
    expect(window.FB.login).toHaveBeenCalledWith(
      expect.any(Function),
      { scope: "email,public_profile" }
    );

    // Verify backend was called with correct payload
    expect(http.post).toHaveBeenCalledWith("authWeb/social-auth", {
      provider: "facebook",
      idToken: "fb-access-token-123",
    });

    // Verify tokens stored in localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "idToken",
      "cognito-id-token"
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "accessToken",
      "cognito-access-token"
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "refToken",
      "cognito-refresh-token"
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "username",
      "jane@facebook.com"
    );

    // Verify return value
    expect(result).toEqual(mockBackendResponse.data);
  });

  it("should throw CANCELLED error when user closes popup (status: unknown)", async () => {
    const cancelledResponse = {
      status: "unknown",
      authResponse: null,
    };

    setupFBSDKMock(cancelledResponse);

    await expect(signInWithFacebook()).rejects.toMatchObject({
      message: "Facebook sign-in was cancelled.",
      code: "CANCELLED",
    });

    // Backend should NOT have been called
    expect(http.post).not.toHaveBeenCalled();
  });

  it("should throw CANCELLED error when user declines permissions (status: not_authorized)", async () => {
    const notAuthorizedResponse = {
      status: "not_authorized",
      authResponse: null,
    };

    setupFBSDKMock(notAuthorizedResponse);

    await expect(signInWithFacebook()).rejects.toMatchObject({
      message: "Facebook sign-in was cancelled.",
      code: "CANCELLED",
    });

    expect(http.post).not.toHaveBeenCalled();
  });

  it("should throw enhanced error on backend failure", async () => {
    const fbLoginResponse = {
      status: "connected",
      authResponse: {
        accessToken: "fb-access-token-123",
        userID: "fb-user-001",
      },
    };

    setupFBSDKMock(fbLoginResponse);
    http.post.mockRejectedValue({
      response: {
        status: 401,
        data: { error: "Facebook token verification failed." },
      },
    });

    await expect(signInWithFacebook()).rejects.toMatchObject({
      message: "Facebook token verification failed.",
      status: 401,
    });
  });

  it("should throw error when no access token in Facebook response", async () => {
    const noTokenResponse = {
      status: "connected",
      authResponse: {
        // No accessToken
        userID: "fb-user-001",
      },
    };

    setupFBSDKMock(noTokenResponse);

    await expect(signInWithFacebook()).rejects.toMatchObject({
      message: "No access token received from Facebook.",
    });

    expect(http.post).not.toHaveBeenCalled();
  });

  it("should load Facebook SDK dynamically if not already present", async () => {
    const appendChildSpy = jest.spyOn(document.head, "appendChild");

    appendChildSpy.mockImplementation((script) => {
      // Simulate SDK load: set window.FB then invoke fbAsyncInit
      window.FB = {
        init: jest.fn(),
        login: jest.fn((callback) => {
          callback({
            status: "connected",
            authResponse: { accessToken: "fb-token", userID: "user-1" },
          });
        }),
      };
      // Call fbAsyncInit as the real SDK would
      if (window.fbAsyncInit) {
        window.fbAsyncInit();
      }
    });

    http.post.mockResolvedValue(mockBackendResponse);

    await signInWithFacebook();

    // Verify script was appended
    expect(appendChildSpy).toHaveBeenCalled();
    const script = appendChildSpy.mock.calls[0][0];
    expect(script.src).toBe("https://connect.facebook.net/en_US/sdk.js");

    // Verify FB.init was called with correct config
    expect(window.FB.init).toHaveBeenCalledWith({
      appId: FACEBOOK_APP_ID,
      cookie: true,
      xfbml: false,
      version: "v19.0",
    });

    appendChildSpy.mockRestore();
  });

  it("should throw error when SDK fails to load", async () => {
    const appendChildSpy = jest.spyOn(document.head, "appendChild");
    appendChildSpy.mockImplementation((script) => {
      script.onerror();
    });

    await expect(signInWithFacebook()).rejects.toMatchObject({
      message: "Failed to load Facebook SDK.",
    });

    appendChildSpy.mockRestore();
  });
});


describe("signInWithGoogle", () => {
  let localStorageMock;

  beforeEach(() => {
    localStorageMock = {};
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key, value) => {
        localStorageMock[key] = value;
      }
    );
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key) => localStorageMock[key] || null
    );

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mockBackendResponse = {
    data: {
      IdToken: "cognito-id-token-google",
      AccessToken: "cognito-access-token-google",
      RefreshToken: "cognito-refresh-token-google",
      userId: "user-789",
      user: { email: "bob@gmail.com", firstName: "Bob", lastName: "Jones" },
      isNewUser: true,
    },
  };

  it("should send Google credential to backend and return auth data on success", async () => {
    http.post.mockResolvedValue(mockBackendResponse);

    const result = await signInWithGoogle("google-id-token-jwt-string");

    // Verify backend was called with correct payload
    expect(http.post).toHaveBeenCalledWith("authWeb/social-auth", {
      provider: "google",
      idToken: "google-id-token-jwt-string",
    });

    // Verify return value
    expect(result).toEqual(mockBackendResponse.data);
  });

  it("should store tokens in localStorage after successful sign-in", async () => {
    http.post.mockResolvedValue(mockBackendResponse);

    await signInWithGoogle("google-id-token-jwt-string");

    // Verify all four keys are stored
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "idToken",
      "cognito-id-token-google"
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "accessToken",
      "cognito-access-token-google"
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "refToken",
      "cognito-refresh-token-google"
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "username",
      "bob@gmail.com"
    );
  });

  it("should throw enhanced error on backend 401 failure", async () => {
    http.post.mockRejectedValue({
      response: {
        status: 401,
        data: { error: "Google token verification failed." },
      },
    });

    await expect(signInWithGoogle("bad-token")).rejects.toMatchObject({
      message: "Google token verification failed.",
      status: 401,
    });
  });

  it("should throw enhanced error on backend 429 rate limit", async () => {
    http.post.mockRejectedValue({
      response: {
        status: 429,
        data: { error: "Too many requests. Please try again later." },
      },
    });

    await expect(signInWithGoogle("some-token")).rejects.toMatchObject({
      message: "Too many requests. Please try again later.",
      status: 429,
    });
  });

  it("should use fallback message when backend returns no error details", async () => {
    http.post.mockRejectedValue({
      response: {
        status: 500,
        data: {},
      },
    });

    await expect(signInWithGoogle("some-token")).rejects.toMatchObject({
      message: "Google sign-in failed. Please try again.",
      status: 500,
    });
  });

  it("should handle missing fields in response gracefully (no IdToken)", async () => {
    const partialResponse = {
      data: {
        // Missing IdToken, AccessToken, RefreshToken
        userId: "user-789",
        user: { email: "bob@gmail.com" },
      },
    };
    http.post.mockResolvedValue(partialResponse);

    const result = await signInWithGoogle("google-token");

    // Should not throw — just doesn't store missing tokens
    expect(result).toEqual(partialResponse.data);
    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      "idToken",
      expect.anything()
    );
    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      "accessToken",
      expect.anything()
    );
    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      "refToken",
      expect.anything()
    );
    // Username should still be stored since email is present
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "username",
      "bob@gmail.com"
    );
  });

  it("should handle missing user.email in response (no username stored)", async () => {
    const noEmailResponse = {
      data: {
        IdToken: "id-token",
        AccessToken: "access-token",
        RefreshToken: "refresh-token",
        userId: "user-789",
        user: { firstName: "Bob" },
        // No email in user object
      },
    };
    http.post.mockResolvedValue(noEmailResponse);

    const result = await signInWithGoogle("google-token");

    expect(result).toEqual(noEmailResponse.data);
    // Tokens should be stored
    expect(localStorage.setItem).toHaveBeenCalledWith("idToken", "id-token");
    expect(localStorage.setItem).toHaveBeenCalledWith("accessToken", "access-token");
    expect(localStorage.setItem).toHaveBeenCalledWith("refToken", "refresh-token");
    // Username should NOT be stored since no email
    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      "username",
      expect.anything()
    );
  });
});


describe("Token storage format validation", () => {
  let localStorageMock;

  beforeEach(() => {
    localStorageMock = {};
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key, value) => {
        localStorageMock[key] = value;
      }
    );
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key) => localStorageMock[key] || null
    );

    jest.clearAllMocks();
    delete window.AppleID;
    delete window.FB;
    delete window.fbAsyncInit;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const standardBackendResponse = {
    data: {
      IdToken: "std-id-token",
      AccessToken: "std-access-token",
      RefreshToken: "std-refresh-token",
      userId: "user-std",
      user: { email: "user@example.com", firstName: "Test", lastName: "User" },
      isNewUser: false,
    },
  };

  it("should store exactly the keys: idToken, accessToken, refToken, username after Google auth", async () => {
    http.post.mockResolvedValue(standardBackendResponse);

    await signInWithGoogle("google-credential");

    const storedKeys = Object.keys(localStorageMock);
    expect(storedKeys).toContain("idToken");
    expect(storedKeys).toContain("accessToken");
    expect(storedKeys).toContain("refToken");
    expect(storedKeys).toContain("username");
    expect(storedKeys).toHaveLength(4);
  });

  it("should store exactly the keys: idToken, accessToken, refToken, username after Apple auth", async () => {
    window.AppleID = {
      auth: {
        init: jest.fn(),
        signIn: jest.fn().mockResolvedValue({
          authorization: { id_token: "apple-jwt" },
        }),
      },
    };
    http.post.mockResolvedValue(standardBackendResponse);

    await signInWithApple();

    const storedKeys = Object.keys(localStorageMock);
    expect(storedKeys).toContain("idToken");
    expect(storedKeys).toContain("accessToken");
    expect(storedKeys).toContain("refToken");
    expect(storedKeys).toContain("username");
    expect(storedKeys).toHaveLength(4);
  });

  it("should store exactly the keys: idToken, accessToken, refToken, username after Facebook auth", async () => {
    window.FB = {
      init: jest.fn(),
      login: jest.fn((callback) => {
        callback({
          status: "connected",
          authResponse: { accessToken: "fb-token", userID: "user-1" },
        });
      }),
    };
    http.post.mockResolvedValue(standardBackendResponse);

    await signInWithFacebook();

    const storedKeys = Object.keys(localStorageMock);
    expect(storedKeys).toContain("idToken");
    expect(storedKeys).toContain("accessToken");
    expect(storedKeys).toContain("refToken");
    expect(storedKeys).toContain("username");
    expect(storedKeys).toHaveLength(4);
  });

  it("should map backend response fields correctly to localStorage keys", async () => {
    http.post.mockResolvedValue(standardBackendResponse);

    await signInWithGoogle("credential");

    // IdToken -> idToken, AccessToken -> accessToken, RefreshToken -> refToken
    expect(localStorageMock["idToken"]).toBe("std-id-token");
    expect(localStorageMock["accessToken"]).toBe("std-access-token");
    expect(localStorageMock["refToken"]).toBe("std-refresh-token");
    expect(localStorageMock["username"]).toBe("user@example.com");
  });
});
