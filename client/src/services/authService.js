import http from "../utils/axios/http";

export const signUp = async (params) => {
  try {
    const response = await http.post("auth/sign-up", params);
    return response.data;
  } catch (error) {
    throw new Error(error);
  }
};

export const getToken = async (params) => {
  try {
    const response = await http.post( "auth/log-in", params );
    console.log(response)
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
