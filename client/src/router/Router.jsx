import React from "react";

import {createBrowserRouter, RouterProvider} from "react-router-dom";
import ErrorPage from "./ErrorPage";
import LoginView, {LoaderLogin} from "../views/Login/LoginView";

const router = createBrowserRouter([
  {
    errorElement: <ErrorPage />,
    children: [
      {
        path: "login",
        element: <LoginView />,
        loader: LoaderLogin,
      },
   
    ],
  },
]);

const Router = () => {
  return <RouterProvider router={router} />;
};

export default Router;
