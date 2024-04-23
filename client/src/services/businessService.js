import http from "../utils/axios/http";

export const getPresignedUrlForBusiness = (userId) => {
  return http.get(`/business/${userId}/pre-signed-url`)
};

export const getBusiness = (userId) => {
  return http.get(`/business/${userId}`)
};

export const updateBusiness = (body) => {
  return http.put(`/business`, body)
};
