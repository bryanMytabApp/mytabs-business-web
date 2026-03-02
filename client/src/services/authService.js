import http from "../utils/axios/http";

export const signUp = async (params) => {
  try {
    const response = await http.post("auth/sign-up", params);
    return response.data;
  } catch (error) {
    throw enhanceError(error, "An error occurred during the request.");
  }
};

export const getToken = async (params) => {
  try {
    const response = await http.post("auth/log-in", params);
    return response.data;
  } catch (error) {
    throw new Error(error);
  }
};

export const loginMobile = async (params) => {
  try {
    const response = await http.post("authMobile/log-in-Mobile", params);
    return response.data;
  } catch (error) {
    throw new Error(error);
  }
};

export const getUserByAttribute = async (params) => {
  try {
    const response = await http.post( "auth/get-user-by-attribute", params );
    return response.data;
  } catch (error) {
    throw new Error(error);
  }
};

export const requestResetPassword = async (params) => {
  try {
    const response = await http.post("auth/request-reset-password", params);
    return response.data;
  } catch (error) {
    throw new Error(error);
  }
};

export const confirmResetPassword = async (params) => {
  try {
    const response = await http.post("auth/confirm-reset-password", params);
    return response.data;
  } catch (error) {
    throw new Error(error);
  }
};

export const logout = async (params) => {
  try {
    const response = await http.post("auth/logout", params);
    return response.data;
  } catch (error) {
    throw new Error(error);
  }
};

export const changePassword = async (params) => {
  try {
    const response = await http.post("auth/change-password", params);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

function enhanceError(error) {
  if (error.response && typeof error.response.data === "string") {
    try {
      const parsedData = JSON.parse(error.response.data);
      if (parsedData.error) {
        error.enhancedMessage = parsedData.error;
      }
    } catch (parseError) {
      console.error("Error parsing error response data:", parseError);
    }
  }
  return error;
}



export const completeNewPasswordChallenge = async (params) => {
  try {
    const response = await http.post("auth/complete-new-password", params);
    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
