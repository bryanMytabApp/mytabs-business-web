import React, {useEffect, useState} from "react";
import {Outlet, redirect, NavLink, useLocation, Link} from "react-router-dom";
import {ReactSVG} from "react-svg";

import "./HomeView.css";
import logo from "../assets/menu/HomeviewTab.svg";
import homeInactiveIcon from "../assets/menu/homeInactive.svg";
import homeActiveIcon from "../assets/menu/homeActive.svg";
import clientCatalogInactiveIcon from "../assets/menu/clientCatalogInactive.svg";
import clientCatalogActiveIcon from "../assets/menu/clientCatalogActive.svg";
import userCatalogInactiveIcon from "../assets/menu/userCatalogInactive.svg";
import userCatalogActiveIcon from "../assets/menu/userCatalogActive.svg";
import myEventsInactiveIcon from "../assets/menu/myEventsInactive.svg";
import myEventsActiveIcon from "../assets/menu/myEventsActive.svg";
import analyticsActiveIcon from "../assets/menu/analyticsActive.svg";
import analyticsInactiveIcon from "../assets/menu/analyticsInactive.svg";
import upgradesAddonsActiveIcon from "../assets/menu/upgradesAddonsActive.svg";
import upgradesAddonsInactiveIcon from "../assets/menu/upgradesAddonsInactive.svg";
import shopActiveIcon from "../assets/menu/shopActive.svg";
import shopInactiveIcon from "../assets/menu/shopInactive.svg";
import configurationActiveIcon from "../assets/menu/configurationActive.svg";
import configurationInactiveIcon from "../assets/menu/configurationInactive.svg";
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
    path: "/admin/my-business",
    icon: {
      inactive: clientCatalogInactiveIcon,
      active: clientCatalogActiveIcon,
    },
    title: "My Business",
  },
  {
    path: "/admin/my-events",
    icon: {
      active: myEventsActiveIcon,
      inactive: myEventsInactiveIcon,
    },
    title: "My Ads",
  },
  {
    path: "/admin/analytics",
    icon: {
      active: analyticsActiveIcon,
      inactive: analyticsInactiveIcon,
    },
    title: "Analytics",
  },
  {
    path: "/admin/upgrades-and-add-ons",
    icon: {
      active: upgradesAddonsActiveIcon,
      inactive: upgradesAddonsInactiveIcon,
    },
    title: "Upgrades and add ons",
  },
  {
    path: "/admin/shop",
    icon: {
      active: shopActiveIcon,
      inactive: shopInactiveIcon,
    },
    title: "Shop",
  },
  {
    path: "/admin/configuration",
    icon: configurationInactiveIcon,
    title: "Configuration",
  },
  {path: "/logout", icon: logout, title: "Logout"},
];

const state = {user: ""};
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
                <div
                  style={{
                    fontFamily: "Outfit",
                    fontWeight: 700,
                    alignSelf: "center",
                    fontSize: "24px",
                  }}>
                  Dashboard
                </div>
              )}
            </div>
            <div
              style={{
                fontFamily: "Poppins",
                flex: 5,
                backgroundColor: "white",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-evenly",
                gap: "10px",
                padding: "8px",
                marginTop: "32px",
                borderRadius: "10px",
              }}>
              {options
                .filter((item) => !["Logout", "Configuration"].includes(item.title))
                .map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({isActive}) => (!isActive ? "Menu-option-expanded" : "Menu-option")}
                    children={({isActive}) => (
                      <>
                        <ReactSVG src={isActive ? item.icon.active : item.icon.inactive} />
                        {isExpanded && <span style={{marginLeft: "8px"}}>{item.title}</span>}
                      </>
                    )}
                  />
                ))}
            </div>
            <div style={{display: "flex", flex: 4}}></div>

            <div
              style={{
                display: "flex",
                flex: 3,
                paddingTop: "16px",
                alignContent: "center",
              }}
              className='Menu-option'>
              <div
                style={{
                  flex: 1,
                  backgroundColor: "white",
                  display: "flex",
                  flexDirection: "column-reverse",
                  justifyContent: "normal",
                  gap: "10px",
                  padding: "8px",
                  borderRadius: "10px",
                }}>
                <NavLink
                  key={options[options.length - 1].path}
                  style={{backgroundColor: !isExpanded ? null : "white"}}
                  className={isExpanded ? "Menu-option" : "Menu-option-expanded"}
                  to={options[options.length - 1].path}>
                  <ReactSVG src={options[options.length - 1].icon} />
                  {isExpanded && (
                    <span style={{marginLeft: "8px", backgroundColor: "white", fontWeight: 500}}>
                      {options[options.length - 1].title}
                    </span>
                  )}
                </NavLink>
                <NavLink
                  key={options[options.length - 2].path}
                  style={{backgroundColor: !isExpanded ? null : "white", fontFamily: "Poppins", fontWeight: 500}}
                  className={isExpanded ? "Menu-option" : "Menu-option-expanded"}
                  to={options[options.length - 2].path}>
                  <ReactSVG src={options[options.length - 2].icon} />
                  {isExpanded && (
                    <span style={{marginLeft: "8px", backgroundColor: "white", fontWeight: 500}}>
                      {options[options.length - 2].title}
                    </span>
                  )}
                </NavLink>
                <div
                  style={{
                    height: "1px",
                    backgroundColor: "#71727255",
                  }}></div>
              </div>
            </div>
          </div>
        </div>
        <div className='View'>
          <Outlet />
        </div>
      </div>
    </UserDataProvider>
  );
}
