import React, {useEffect} from "react";
import {Outlet, redirect, NavLink, useLocation} from "react-router-dom";
import {ReactSVG} from "react-svg";

import "./HomeView.css";
import logo from "../assets/logo.png";

import dashboards from "../assets/menu/dashboards.svg";

import logout from "../assets/menu/logout.svg";

import {UserDataProvider} from "../utils/UserDataProvider";
import {getCookie} from "../utils/Tools.ts";

const options = [

  {path: "/admin/dashboards", icon: dashboards, title: "Dashboards"},
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

  useEffect(() => {
    const selectedMenuOption = options.find(
      (x) => x.path.substring(1) === location.pathname.split("/")[1]
    );

    const title = [
      "My Tabs",
      selectedMenuOption?.title,
      ...location.pathname.split("/").slice(2),
    ];

    document.title = title.filter((x) => x).join(" - ");
  }, [location.pathname]);

  return (
    <UserDataProvider>
      <div className='HomeView'>
        <div className='Sidebar'>
          <img src={logo} alt='logo' />

          <div className='Menu'>
            {options.map((item) => (
              <NavLink key={item.path} className='Menu-option' to={item.path}>
                <ReactSVG src={item.icon} />
                <span>{item.title}</span>
              </NavLink>
            ))}
          </div>
        </div>

        <div className='View'>
          <Outlet />
        </div>
      </div>
    </UserDataProvider>
  );
}
