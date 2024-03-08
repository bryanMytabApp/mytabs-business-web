import React, {useEffect, useState} from "react";
import {Outlet, redirect, NavLink, useLocation} from "react-router-dom";
import {ReactSVG} from "react-svg";

import "./HomeView.css";
import logo from "../assets/menu/HomeviewTab.svg";
import homeInactiveIcon from "../assets/menu/homeInactive.svg";
import homeActiveIcon from "../assets/menu/homeActive.svg";
import clientCatalogInactiveIcon from "../assets/menu/clientCatalogInactive.svg";
import clientCatalogActiveIcon from "../assets/menu/clientCatalogActive.svg";
import userCatalogInactiveIcon from "../assets/menu/userCatalogInactive.svg";
import userCatalogActiveIcon from "../assets/menu/userCatalogActive.svg";

import logout from "../assets/menu/logout.svg";

import {UserDataProvider} from "../utils/UserDataProvider";
import {getCookie} from "../utils/Tools.ts";

const options = [
  {
    path: "/admin/home",
    icon: {
      active: homeActiveIcon,
      inactive: homeInactiveIcon,
    },
    title: "Home",
  },
  {
    path: "/admin/client-catalog",
    icon: {
      inactive: clientCatalogInactiveIcon,
      active: clientCatalogActiveIcon,
    },
    title: "Client Catalog",
  },
  {
    path: "/admin/user-catalog",
    icon: {
      active: userCatalogActiveIcon,
      inactive: userCatalogInactiveIcon,
    },
    title: "User Catalog",
  },
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

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };
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
        <div className={isExpanded ? "Sidebar-expanded" : "Sidebar"}>
          <div className='Menu'>
            <div id='Menu-option-logo' style={{flex: 1}} onClick={handleExpand}>
              <img src={logo} alt='logo' />
              {isExpanded && (
                <div style={{fontFamily: "Outfit", fontWeight: 700, alignSelf: "center"}}>
                  Dashboard
                </div>
              )}
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
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({isActive}) => (!isActive ? "Menu-option-expanded" : "Menu-option")}
                    children={({isActive}) => (
                      <>
                        <ReactSVG src={isActive ? item.icon.active : item.icon.inactive} />
                        {isExpanded && <span style={{marginLeft: "16px"}}>{item.title}</span>}
                      </>
                    )}
                  />
                ))}
            </div>
            <div style={{flex: 8}}></div>
            <div
              style={{
                height: "1px",
                backgroundColor: "#797676",
              }}></div>
            <div style={{display: "flex", flex: 0.25, paddingTop: "16px"}} className='Menu-option'>
              <NavLink
                key={options[3].path}
                className={isExpanded ? "Menu-option-expanded" : "Menu-option"}
                to={options[3].path}>
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
