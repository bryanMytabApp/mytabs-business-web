import React, { Suspense, lazy } from "react";
import { createBrowserRouter, RouterProvider, redirect, Outlet } from "react-router-dom";
import ErrorPage from "./ErrorPage";
import TabsHelp from "../components/TabsHelp/TabsHelp";

// Help context API. Set DOC_SYNC_HELP_API_URL at build time to override.
const HELP_API_URL =
  process.env.REACT_APP_HELP_API_URL ||
  "https://zsvzaeu172.execute-api.us-east-1.amazonaws.com/help/context";

const HELP_CHAT_URL =
  process.env.REACT_APP_HELP_CHAT_URL ||
  "https://zsvzaeu172.execute-api.us-east-1.amazonaws.com/help/chat";

// Public help site root. The SDK builds per-route deep links of the form
// {root}/web/{slug}, e.g.  /admin/my-business#profile  →
// https://help.keeptabs.app/web/admin-my-business-profile
const HELP_SITE_URL =
  process.env.REACT_APP_HELP_SITE_URL ||
  "https://help.keeptabs.app";

// Layout that mounts on every route. TabsHelp uses useLocation() under the
// hood so it MUST live inside the RouterProvider tree, which is why it
// can't go in App.jsx alongside other providers.
const AppLayout = () => (
  <>
    <Outlet />
    <TabsHelp
      apiUrl={HELP_API_URL}
      chatUrl={HELP_CHAT_URL}
      role="business-owner"
      brand="Help"
      headless
      panelTopOffset={53}
      helpSiteUrl={HELP_SITE_URL}
    />
  </>
);

// Single page-level loading state for route chunk transitions. Lives inside
// the AppLayout's <Outlet /> Suspense boundary, so it renders within the
// content area only — the sidebar/topbar stay put. Per-view full-page
// spinners are intentionally NOT used; views render their shell immediately
// so the user only ever sees one loader, not a stack.
const PageLoader = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '50vh',
    background: 'linear-gradient(135deg,#e8f4fd 0%,#dbeeff 35%,#f0f8ff 65%,#e2eeff 100%)',
    padding: '24px',
  }}>
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        border: '3px solid #e0e0e0',
        borderTopColor: '#F09925',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  </div>
);

// Lazy load all views - this splits the bundle into separate chunks
// Auth views (small, load fast)
const LoginView = lazy(() => import("../views/Login/LoginView"));
const RegistrationView = lazy(() => import("../views/Login/RegistrationView"));
const PasswordRecovery = lazy(() => import("../views/Login/PasswordRecovery"));
const ChangePasswordView = lazy(() => import("../views/Login/ChangePasswordView"));
const DeleteAccountView = lazy(() => import("../views/Login/DeleteAccountView"));

// Main layout
const HomeView = lazy(() => import("../views/HomeView"));

// Dashboard views
const Dashboard = lazy(() => import("../views/Dashboards/Dashboard"));
const HomeMainView = lazy(() => import("../views/HomeMain/HomeMainView"));
const AnalyticsView = lazy(() => import("../views/Analytics/AnalyticsView"));

// Business views
const MyBusiness = lazy(() => import("../views/MyBusiness/MyBusiness"));
const ClientCatalogView = lazy(() => import("../views/ClientCatalog/ClientCatalogView"));
const UserCatalogView = lazy(() => import("../views/UserCatalog/UserCatalogView"));

// Event views (heavy - has QR, PDF, etc)
const EventsView = lazy(() => import("../views/Events/EventsView"));
const EventCreate = lazy(() => import("../views/Events/EventCreate"));
const EventCreateNew = lazy(() => import("../views/Events/EventCreateNew"));
const EventEditNew = lazy(() => import("../views/Events/EventEditNew"));

// Subscription views
const SubscriptionView = lazy(() => import("../views/Subscription/SubscriptionView"));
const SubscriptionViewPart = lazy(() => import("../views/Subscription/SubscriptionViewPart"));
const SubscriptionSuccess = lazy(() => import("../views/Subscription/SubscriptionSuccess"));

// Ticket views
const MyTicketsView = lazy(() => import("../views/MyTickets/MyTicketsView"));
const TicketPurchase = lazy(() => import("../views/Tickets/TicketPurchase"));
const TicketSuccess = lazy(() => import("../views/Tickets/TicketSuccess"));
const TicketCancel = lazy(() => import("../views/Tickets/TicketCancel"));

// Organization views
const OrganizationList = lazy(() => import("../views/Organization/OrganizationList"));
const OrganizationDashboard = lazy(() => import("../views/Organization/OrganizationDashboard"));
const CreateOrganization = lazy(() => import("../views/Organization/CreateOrganization"));

// AI Agent views
const AiAgentSubscribe = lazy(() => import("../views/AiAgents/AiAgentSubscribe"));
const AiAgentDashboard = lazy(() => import("../views/AiAgents/AiAgentDashboard"));
const AiAgentDetail = lazy(() => import("../views/AiAgents/AiAgentDetail"));
const AiAgentRouteGuard = lazy(() => import("../components/AiAgentRouteGuard"));
const UrbanHTXRouteGuard = lazy(() => import("../components/UrbanHTXRouteGuard"));

// Experience views (admin dashboard)
const ExperiencesDashboard = lazy(() => import("../views/Experiences/ExperiencesDashboard"));
const AllExperiencesDashboard = lazy(() => import("../views/Experiences/AllExperiencesDashboard"));
const ExperienceCatalog = lazy(() => import("../views/Experiences/ExperienceCatalog"));
const RaffleConfig = lazy(() => import("../views/Experiences/RaffleConfig"));
const RaffleLiveDashboard = lazy(() => import("../views/Experiences/RaffleLiveDashboard"));
const DrawingHistory = lazy(() => import("../views/Experiences/DrawingHistory"));
const EntryManagement = lazy(() => import("../views/Experiences/EntryManagement"));
const FulfillmentManagement = lazy(() => import("../views/Experiences/FulfillmentManagement"));
const ExperienceAnalytics = lazy(() => import("../views/Experiences/ExperienceAnalytics"));
const SponsorManagement = lazy(() => import("../views/Experiences/SponsorManagement"));
const PermissionsPanel = lazy(() => import("../views/Experiences/PermissionsPanel"));
const CompliancePanel = lazy(() => import("../views/Experiences/CompliancePanel"));
const DrawComplianceReport = lazy(() => import("../views/Experiences/DrawComplianceReport"));

// Other views
const ShopView = lazy(() => import("../views/Shop/ShopView"));
const SettingsPlatform = lazy(() => import("../views/MyTabsConfiguration/SettingsPlatform"));
const AdminPortal = lazy(() => import("../views/Admin/AdminPortal"));
const BusinessRedirect = lazy(() => import("../views/BusinessRedirect"));
const ServiceLanding = lazy(() => import("../views/ServiceLanding/ServiceLanding"));
const MarketIntelligence = lazy(() => import("../views/ServiceLanding/MarketIntelligence"));
const JumpPage = lazy(() => import("../views/JumpPage/JumpPage"));

// Wrapper component for lazy-loaded routes
const LazyRoute = ({ children }) => (
  <Suspense fallback={<PageLoader />}>
    {children}
  </Suspense>
);

const routerHandler = (isIntern, allowPass = false) => {
  const _idToken = localStorage.getItem("idToken");

  if (!_idToken && isIntern) {
    return redirect("/login");
  } else if (_idToken && !isIntern) {
    if (allowPass) {
      return false;
    }
    return redirect("/admin/home");
  }
  return false;
};

const router = createBrowserRouter([
  {
    element: <AppLayout />,
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
        element: <LazyRoute><LoginView /></LazyRoute>,
        loader: () => {
          const params = new URLSearchParams(window.location.search);
          const hasReturnUrl = params.has('returnUrl');
          return routerHandler(false, hasReturnUrl);
        },
      },
      {
        path: "password-recovery",
        element: <LazyRoute><PasswordRecovery /></LazyRoute>,
        loader: () => routerHandler(false, true),
      },
      {
        path: "change-password",
        element: <LazyRoute><ChangePasswordView /></LazyRoute>,
        loader: () => routerHandler(true, true),
      },
      {
        path: "delete-account",
        element: <LazyRoute><DeleteAccountView /></LazyRoute>,
        loader: () => routerHandler(false),
      },
      {
        path: "register",
        element: <LazyRoute><RegistrationView /></LazyRoute>,
        loader: () => routerHandler(false),
      },
      {
        path: "subscription",
        element: <LazyRoute><SubscriptionView /></LazyRoute>,
      },
      {
        path: "subpart",
        element: <LazyRoute><SubscriptionViewPart /></LazyRoute>,
      },
      {
        path: "success",
        element: <LazyRoute><SubscriptionSuccess /></LazyRoute>,
      },
      {
        path: "success/session_id=:sessionId",
        element: <LazyRoute><SubscriptionSuccess /></LazyRoute>,
      },
      {
        path: "user/:userId",
        Component: () => {
          window.location.href = 'https://www.mytabs.app';
          return null;
        }
      },
      {
        path: "business/:businessId",
        element: <LazyRoute><BusinessRedirect /></LazyRoute>,
        loader: ({ params }) => params.businessId,
      },
      {
        path: "admin-portal",
        element: <LazyRoute><AdminPortal /></LazyRoute>,
      },
      {
        path: "tickets/:eventId",
        element: <LazyRoute><TicketPurchase /></LazyRoute>,
      },
      {
        path: "tickets/success",
        element: <LazyRoute><TicketSuccess /></LazyRoute>,
      },
      {
        path: "tickets/cancel",
        element: <LazyRoute><TicketCancel /></LazyRoute>,
      },
      {
        path: "b/:code",
        element: <LazyRoute><JumpPage /></LazyRoute>,
      },
      {
        path: "business/ai-agents/subscribe",
        element: <LazyRoute><AiAgentSubscribe /></LazyRoute>,
        loader: () => routerHandler(true),
      },
      {
        path: "m/:code",
        element: <LazyRoute><JumpPage /></LazyRoute>,
      },
      {
        path: "e/:code",
        element: <LazyRoute><JumpPage /></LazyRoute>,
      },
      {
        path: "o/:code",
        element: <LazyRoute><JumpPage /></LazyRoute>,
      },
      {
        path: "/admin",
        element: <LazyRoute><HomeView /></LazyRoute>,
        loader: () => routerHandler(true),
        children: [
          {
            path: "dashboards",
            element: <LazyRoute><Dashboard /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "home",
            element: <LazyRoute><HomeMainView /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "client-catalog",
            element: <LazyRoute><ClientCatalogView /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "user-catalog",
            element: <LazyRoute><UserCatalogView /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-business",
            element: <LazyRoute><MyBusiness /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-business/:businessId",
            element: <LazyRoute><MyBusiness /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events",
            element: <LazyRoute><EventsView /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "experiences",
            element: <LazyRoute><UrbanHTXRouteGuard featureName="Tab Engagements across events"><AllExperiencesDashboard /></UrbanHTXRouteGuard></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/create",
            element: <LazyRoute><EventCreateNew /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/create-old",
            element: <LazyRoute><EventCreate /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/:eventId",
            element: <LazyRoute><EventEditNew /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/:eventId/experiences",
            element: <LazyRoute><UrbanHTXRouteGuard featureName="Event Engagements"><ExperiencesDashboard /></UrbanHTXRouteGuard></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/:eventId/experiences/catalog",
            element: <LazyRoute><UrbanHTXRouteGuard featureName="Event Engagements"><ExperienceCatalog /></UrbanHTXRouteGuard></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/:eventId/experiences/:experienceId/config",
            element: <LazyRoute><UrbanHTXRouteGuard featureName="Event Engagements"><RaffleConfig /></UrbanHTXRouteGuard></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/:eventId/experiences/:experienceId/live",
            element: <LazyRoute><UrbanHTXRouteGuard featureName="Event Engagements"><RaffleLiveDashboard /></UrbanHTXRouteGuard></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/:eventId/experiences/:experienceId/drawings",
            element: <LazyRoute><UrbanHTXRouteGuard featureName="Event Engagements"><DrawingHistory /></UrbanHTXRouteGuard></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/:eventId/experiences/:experienceId/draw-report",
            element: <LazyRoute><UrbanHTXRouteGuard featureName="Event Engagements"><DrawComplianceReport /></UrbanHTXRouteGuard></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/:eventId/experiences/:experienceId/entries",
            element: <LazyRoute><UrbanHTXRouteGuard featureName="Event Engagements"><EntryManagement /></UrbanHTXRouteGuard></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/:eventId/experiences/:experienceId/fulfillment",
            element: <LazyRoute><UrbanHTXRouteGuard featureName="Event Engagements"><FulfillmentManagement /></UrbanHTXRouteGuard></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/:eventId/experiences/:experienceId/analytics",
            element: <LazyRoute><UrbanHTXRouteGuard featureName="Event Engagements"><ExperienceAnalytics /></UrbanHTXRouteGuard></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/:eventId/experiences/:experienceId/sponsors",
            element: <LazyRoute><UrbanHTXRouteGuard featureName="Event Engagements"><SponsorManagement /></UrbanHTXRouteGuard></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/:eventId/experiences/:experienceId/permissions",
            element: <LazyRoute><UrbanHTXRouteGuard featureName="Event Engagements"><PermissionsPanel /></UrbanHTXRouteGuard></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-events/:eventId/experiences/:experienceId/compliance",
            element: <LazyRoute><UrbanHTXRouteGuard featureName="Event Engagements"><CompliancePanel /></UrbanHTXRouteGuard></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "analytics",
            element: <LazyRoute><AnalyticsView /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "my-tickets",
            element: <LazyRoute><MyTicketsView /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "shop",
            element: <LazyRoute><ShopView /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "configuration",
            element: <LazyRoute><SettingsPlatform /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "admin-portal",
            element: <LazyRoute><AdminPortal /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "organization",
            element: <LazyRoute><OrganizationList /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "organization/create",
            element: <LazyRoute><CreateOrganization /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "organization/:id",
            element: <LazyRoute><OrganizationDashboard /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "service/market-intelligence",
            element: <LazyRoute><MarketIntelligence /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "service/:serviceId",
            element: <LazyRoute><ServiceLanding /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "ai-agents/subscribe",
            element: <LazyRoute><AiAgentSubscribe /></LazyRoute>,
            loader: () => routerHandler(true),
          },
          {
            path: "ai-agents",
            element: <LazyRoute><AiAgentRouteGuard><Outlet /></AiAgentRouteGuard></LazyRoute>,
            loader: () => routerHandler(true),
            children: [
              {
                index: true,
                element: <LazyRoute><AiAgentDashboard /></LazyRoute>,
              },
              {
                path: "dashboard",
                element: <LazyRoute><AiAgentDashboard /></LazyRoute>,
              },
              {
                path: ":agentId",
                element: <LazyRoute><AiAgentDetail /></LazyRoute>,
              },
            ],
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
