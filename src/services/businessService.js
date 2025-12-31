import http from "../utils/axios/http";

export const getPresignedUrlForBusiness = (userId) => {
  return http.get(`/business/${userId}/pre-signed-url`)
};

export const getPresignedUrlForGalleryPhoto = (userId, galleryId, photoIndex) => {
  return http.get(`/business/${userId}/gallery-photo-url?gallery=${galleryId}&index=${photoIndex}`)
};

export const getPresignedUrlForMenu = (userId, menuNum) => {
  return http.get(`/business/${userId}/menu-url?menuNum=${menuNum}`)
};

export const getBusiness = (userId) => {
  return http.get(`/business/${userId}`)
};

export const updateBusiness = (body) => {
  return http.put(`/business`, body)
};
