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

export const forgotPassword = async (params) => {
  try {
    const response = await http.post("auth/forgotPassword", params);
    return response.data;
  } catch (error) {
    throw new Error(error);
  }
};

export const confirmForgotPassword = async (params) => {
  try {
    const response = await http.post("auth/confirmForgotPassword", params);
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
