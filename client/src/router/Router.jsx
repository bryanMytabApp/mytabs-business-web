import React from "react";

import {createBrowserRouter, RouterProvider, redirect} from "react-router-dom";
import ErrorPage from "./ErrorPage";
import LoginView from "../views/Login/LoginView";
import RegistrationView from "../views/Login/RegistrationView";
import Dashboard from "../views/Dashboards/Dashboard";
import HomeView from "../views/HomeView";
import SubscriptionView from "../views/Subscription/SubscriptionView";
import SubscriptionViewPart from "../views/Subscription/SubscriptionViewPart";
import HomeMainView from "../views/HomeMain/HomeMainView";
import ClientCatalogView from "../views/ClientCatalog/ClientCatalogView";
import UserCatalogView from "../views/UserCatalog/UserCatalogView";
import SubscriptionSuccess from "../views/Subscription/SubscriptionSuccess";
import MyBusiness from "../views/MyBusiness/MyBusiness";
import AnalyticsView from "../views/Analytics/AnalyticsView";
import UpgradesAddonsView from "../views/UpgradesAddons/UpgradesAddonsView";
import ShopView from "../views/Shop/ShopView";
import MyTabsConfigurationView from "../views/MyTabsConfiguration/MyTabsConfigurationView";
import EventsView from "../views/Events/EventsView";
import EventCreate from "../views/Events/EventCreate";
import EventEdit from "../views/Events/EventEdit";
import PasswordRecovery from "../views/Login/PasswordRecovery";
import DeleteAccountView from "../views/Login/DeleteAccountView";

const routerHandler = (isIntern, allowPass = false) => {
  const _idToken = localStorage.getItem("idToken");

  if (!_idToken && isIntern) {
    return redirect("/login");
  } else if (_idToken && !isIntern) {
    if(allowPass) {
      return false
    }
    return redirect("/admin/dashboards");
  }
  return false;
};
const router = createBrowserRouter([
  {
    errorElement: <ErrorPage />,
    children: [
       {
        path: "/",
        loader: () => {
          const _idToken = localStorage.getItem("idToken");
          if (_idToken) {
            return redirect("/admin/home");
          } else {
            return redirect("/login");
          }
        },
      },
      {
        path: "login",
        element: <LoginView />,
        loader: () => routerHandler(false),
      },
      {
        path: "password-recovery",
        element: <PasswordRecovery />,
        loader: () => routerHandler(false, true),
      },
      {
        path: "delete-account",
        element: <DeleteAccountView />,
        loader: () => routerHandler(false),
      },
      {
        path: "register",
        element: <RegistrationView />,
        loader: () => routerHandler(false),
      },
      {
        path: "subscription",
        element: <SubscriptionView />,
        // loader: () => routerHandler(true),
      },
      {
        path: "subpart",
        element: <SubscriptionViewPart />,
        // loader: () => routerHandler(true),
      },
      {
        path: "success",
        element: <SubscriptionSuccess />,
        //   loader: async ({ params }) => {
        //     console.log(params.sessionId);
        // },
      },
      {
        path: "success/session_id=:sessionId",
        element: <SubscriptionSuccess />,
        //   loader: async ({ params }) => {
        //     console.log(params.sessionId);
        // },
      },
      {
        path: "user/:userId",
        Component: () => {
          window.location.href = 'https://www.mytabs.app';
          return null;
        }
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
          {
            path: "home",
            element: <HomeMainView />,
            loader: () => routerHandler(true),
          },
          {
            path: "client-catalog",
            element: <ClientCatalogView />,
            loader: () => routerHandler(true),
          },
          {
            path: "user-catalog",
            element: <UserCatalogView />,
            loader: () => routerHandler(true),
          },
          {
            path: "my-business",
            element: <MyBusiness />,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events",
            element: <EventsView />,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/create",
            element: <EventCreate />,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/:eventId",
            element: <EventEdit />,
            loader: () => routerHandler(true),
          },
          {
            path: "analytics",
            element: <AnalyticsView />,
            loader: () => routerHandler(true),
          },
          {
            path: "upgrades-and-add-ons",
            element: <UpgradesAddonsView />,
            loader: () => routerHandler(true),
          },
          {
            path: "shop",
            element: <ShopView />,
            loader: () => routerHandler(true),
          },
          {
            path: "configuration",
            element: <MyTabsConfigurationView />,
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
