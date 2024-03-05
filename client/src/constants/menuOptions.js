// src/constants/menuOptions.js
import homeIcon from "../assets/menu/home.svg";
import clientCatalogIcon from "../assets/menu/clientCatalog.svg";
import userCatalogIcon from "../assets/menu/userCatalog.svg";
import logoutIcon from "../assets/menu/logout.svg";

export const menuOptions = [
  {path: "/admin/dashboards", icon: homeIcon, title: "Home"},
  {path: "/admin/client-catalog", icon: clientCatalogIcon, title: "Client Catalog"},
  {path: "/admin/user-catalog", icon: userCatalogIcon, title: "User Catalog"},
  {path: "/logout", icon: logoutIcon, title: "Logout"},
];
