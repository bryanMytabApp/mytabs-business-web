import React from "react";

import {createBrowserRouter, RouterProvider, redirect} from "react-router-dom";
import ErrorPage from "./ErrorPage";
import LoginView, {LoaderLogin} from "../views/Login/LoginView";
import RegistrationView from "../views/Login/RegistrationView";
import Dashboard from "../views/Dashboards/Dashboard";
import HomeView, { LoaderHome } from "../views/HomeView";

const routerHandler = (isIntern) => {
  const _idToken = localStorage.getItem( 'idToken' );  
  if (!_idToken && isIntern) {
    return redirect("/login");
  } else if (_idToken && !isIntern) {
    return redirect("/admin/dashboards");
  }
  return false;
};

const router = createBrowserRouter([
  {
    errorElement: <ErrorPage />,
    children: [
      {
        path: "login",
        element: <LoginView />,
        loader: () => routerHandler(false),
      },
      {
        path: "register",
        element: <RegistrationView />,
        loader: () => routerHandler(false),
      },
      {
        path: "/admin",
        element: <HomeView />,
        loader: () => routerHandler(true),
        children: [
          {
            path: "dashboards",
            element: <Dashboard />,
            loader: () => routerHandler(true),
          },
        ],
      },
    ],
  },
]);

const Router = () => {
  return <RouterProvider router={router} />;
};

export default Router;
