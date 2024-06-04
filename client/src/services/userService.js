import http from "../utils/axios/http";

export const getUserExistance = async ( {attribute, value} ) => {
  try {
    const response = await http.get(`user/does-it-exists?${attribute}=${value}`);
    return response.data;
  } catch (error) {
    throw enhanceError(error, "Failed to check user existence.");
  }
};

export const getUserById = (userId) => {
  return http.get(`/user/${userId}`)
};

function enhanceError(error, defaultErrorMessage = "An error occurred during the request.") {
  if (error.response) {
    try {
      const responseBody = error.response.data;

      if (typeof responseBody === "object" && responseBody.message) {
        error.enhancedMessage = responseBody.message;
      } else if (typeof responseBody === "string") {
        const parsedBody = JSON.parse(responseBody);
        if (parsedBody && parsedBody.message) {
          error.enhancedMessage = parsedBody.message;
        } else {
          error.enhancedMessage = responseBody;
        }
      } else {
        error.enhancedMessage = defaultErrorMessage;
      }
    } catch (e) {
      console.error("Error parsing response data:", e);
      error.enhancedMessage = defaultErrorMessage;
    }
  } else {
    error.enhancedMessage = defaultErrorMessage;
  }


  return error;
}

export const deleteCognitoUser = (username) => {
  return http.delete(`user/delete-cognito-user/${username}`)
}