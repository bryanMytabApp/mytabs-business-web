import React from "react";

import {createBrowserRouter, RouterProvider} from "react-router-dom";
import ErrorPage from "./ErrorPage";
import LoginView, {LoaderLogin} from "../views/Login/LoginView";
import RegistrationView from "../views/Login/RegistrationView";
import Dashboard from "../views/Dashboards/Dashboard";
import HomeView, {LoaderHome} from "../views/HomeView";
const router = createBrowserRouter([
  {
    errorElement: <ErrorPage />,
    children: [
      {
        path: "login",
        element: <LoginView />,
        loader: LoaderLogin,
      },
      {
        path: "register",
        element: <RegistrationView />,
      },
      {
        path: "/admin",
        element: <HomeView />,
        // loader: LoaderHome,
        children: [
          {
            path: "dashboards",
            element: <Dashboard />,
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
