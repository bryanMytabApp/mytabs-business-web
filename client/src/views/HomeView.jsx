import React, {useEffect, useState} from "react";
import {Outlet, redirect, NavLink, useLocation} from "react-router-dom";
import {ReactSVG} from "react-svg";

import "./HomeView.css";
import logo from "../assets/menu/HomeviewTab.svg";
import homeIcon from "../assets/menu/home.svg";
import clientCatalogIcon from "../assets/menu/clientCatalog.svg";
import userCatalogIcon from "../assets/menu/userCatalog.svg";

import logout from "../assets/menu/logout.svg";

import {UserDataProvider} from "../utils/UserDataProvider";
import {getCookie} from "../utils/Tools.ts";

const options = [
  {path: "/admin/dashboards", icon: homeIcon, title: "Home"},
  {path: "/admin/client-catalog", icon: clientCatalogIcon, title: "Client Catalog"},
  {path: "/admin/user-catalog", icon: userCatalogIcon, title: "User Catalog"},
  {path: "/logout", icon: logout, title: "Logout"},
];

export const LoaderHome = () => {
  const isLoggedIn = getCookie("token") !== null;

  if (!isLoggedIn) {
    localStorage.clear();
    return redirect("/login");
  }

  return null;
};

export default function HomeView() {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  useEffect(() => {
    const selectedMenuOption = options.find(
      (x) => x.path.substring(1) === location.pathname.split("/")[1].split("-")
    );
    const title = ["My Tabs", selectedMenuOption?.title, ...location.pathname.split("/").slice(2)];
    document.title = title.filter((x) => x).join(" - ");
  }, [location.pathname]);

  return (
    <UserDataProvider>
      <div className='HomeView'>
        <div className='Sidebar'>
          <div className='Menu'>
            <div id='Menu-option-logo' style={{flex: 1}}>
              <img src={logo} alt='logo' />
            </div>
            <div
              style={{
                flex: 5,
                backgroundColor: "#F8F9FE",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-evenly",
                gap: "10px",
                padding: "4px",
                marginTop: "32px",
                borderRadius: "10px",
              }}>
              {options
                .filter((item) => item.title !== "Logout")
                .map((item) => (
                  <NavLink key={item.path} className='Menu-option' to={item.path}>
                    <ReactSVG src={item.icon} />
                    {isExpanded && <span>{item.title}</span>}
                  </NavLink>
                ))}
            </div>
            <div style={{flex: 8}}></div>
            <div
              style={{
                height: "1px",
                backgroundColor: "#797676",
              }}></div>
            <div style={{display: "flex", flex: 0.25, paddingTop: "16px"}} className='Menu-option'>
              <NavLink key={options[3].path} className='Menu-option' to={options[3].path}>
                <ReactSVG src={options[3].icon} />
                {isExpanded && <span>{options[3].title}</span>}
              </NavLink>
            </div>
          </div>
        </div>
        <div className='Topbar'></div>
        <div className='View'>
          <Outlet />
        </div>
      </div>
    </UserDataProvider>
  );
}
