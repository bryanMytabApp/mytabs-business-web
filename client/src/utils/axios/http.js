import axios from "axios";
import configJSON from "../config.json";

const config = configJSON;

const axiosConfig = {
  baseURL: config.backendUrl,
  withCredentials: false,
};

const http = axios.create(axiosConfig);

// change this when congnito config is finished
http.interceptors.request.use(
  async function (config) {
    let token = await localStorage.getItem("idToken");

    config.headers.Authorization = `Bearer ${token}`;

    return config;
  },
  function (error) {
    return Promise.reject(error);
  }
);

export default http;

