import React from "react";

import {createBrowserRouter, RouterProvider, redirect} from "react-router-dom";
import ErrorPage from "./ErrorPage";
import LoginView, {LoaderLogin} from "../views/Login/LoginView";
import RegistrationView from "../views/Login/RegistrationView";
import Dashboard from "../views/Dashboards/Dashboard";
import HomeView, { LoaderHome } from "../views/HomeView";
import SubscriptionView from "../views/Subscription/SubscriptionView";
// const routerHandler = (isIntern) => {
//   const _idToken = localStorage.getItem("idToken");
//   // const hasPaid = localStorage.getItem("hasPaid");
//   const hasPaid = false
//   if (!_idToken && isIntern) {
//     return redirect("/login");
//   } else if (_idToken && !isIntern && !hasPaid) {
//     return redirect("/subscription");
//   } else if (_idToken && !isIntern && hasPaid) {
//     return redirect("/admin/dashboards");
//   }
//   return false;
// };
const routerHandler = (isIntern) => {
  const _idToken = localStorage.getItem("idToken");
  console.log(`routerHandler called. isIntern: ${isIntern}, idToken: ${_idToken}`);

  if (!_idToken && isIntern) {
    console.log("Redirecting to /login");
    return redirect("/login");
  } else if (_idToken && !isIntern) {
    console.log("Redirecting to /subscription");
    return redirect("/subscription");
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
        element: <SubscriptionView />,
        loader: () => routerHandler(true),
        children: [
          {
            path: "subscription",
            element: <SubscriptionView />,
            loader: () => routerHandler(true),
          },
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
