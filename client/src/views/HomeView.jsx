import React, {useEffect, useRef, useState} from "react";
import {Outlet, redirect, NavLink, useLocation, useNavigate} from "react-router-dom";
import {ReactSVG} from "react-svg";
import {getMyServices} from "../services/entitlementService";
import {getMyOrganizations} from "../services/organizationService";
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
import myTicketsActiveIcon from "../assets/menu/ticketActive.svg";
import myTicketsInactiveIcon from "../assets/menu/ticketInactive.svg";
import teamInactiveIcon from "../assets/menu/teamInactive.svg";
import upgradesAddonsActiveIcon from "../assets/menu/upgradesAddonsActive.svg";
import upgradesAddonsInactiveIcon from "../assets/menu/upgradesAddonsInactive.svg";
import shopActiveIcon from "../assets/menu/shopActive.svg";
import shopInactiveIcon from "../assets/menu/shopInactive.svg";
import configurationActiveIcon from "../assets/menu/configurationActive.svg";
import configurationInactiveIcon from "../assets/menu/configurationInactive.svg";
import aiDiscoveryActiveIcon from "../assets/menu/aiDiscoveryActive.svg";
import aiDiscoveryInactiveIcon from "../assets/menu/aiDiscoveryInactive.svg";
import experiencesActiveIcon from "../assets/menu/experiencesActive.svg";
import experiencesInactiveIcon from "../assets/menu/experiencesInactive.svg";
import logout from "../assets/menu/logout.svg";

import {UserDataProvider} from "../utils/UserDataProvider";
import {getCookie} from "../utils/Tools.ts";
import {MTBLoading} from "../components";
import {hasMyTicketsAccess, isSuperAdmin} from "../utils/authUtils";
import SessionManager from "../components/SessionManager";
import TopHeaderProfile from "../components/TopHeaderProfile/TopHeaderProfile";
import "../components/TopHeaderProfile/TopHeaderProfile.css";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

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
    path: "/admin/my-business",
    icon: {
      inactive: clientCatalogInactiveIcon,
      active: clientCatalogActiveIcon,
    },
    title: "My Business",
  },
  {
    path: "/admin/my-tickets",
    icon: {
      active: myTicketsActiveIcon,
      inactive: myTicketsInactiveIcon,
    },
    title: "My Tickets",
  },
  {
    path: "/admin/shop",
    icon: {
      active: shopActiveIcon,
      inactive: shopInactiveIcon,
    },
    title: "Shop",
    requiresServiceId: "shop",
  },
  {
    path: "/admin/organization",
    icon: {
      active: userCatalogActiveIcon,
      inactive: userCatalogInactiveIcon,
    },
    title: "Organization",
    requiresServiceId: "organization",
  },
  {
    path: "/admin/ai-agents",
    icon: {
      active: aiDiscoveryActiveIcon,
      inactive: aiDiscoveryInactiveIcon,
    },
    title: "AI Agents",
    requiresOrg: "UrbanHTX",
  },
  {
    path: "/admin/experiences",
    icon: {
      active: experiencesActiveIcon,
      inactive: experiencesInactiveIcon,
    },
    title: "Experiences",
    requiresOrg: "UrbanHTX",
  },
  {
    path: "/admin/configuration",
    icon: configurationInactiveIcon,
    title: "Configuration",
  },
  {
    path: "/logout",
    icon: logout,
    title: "Logout"
  }, 
];

export const LoaderHome = () => {
  const isLoggedIn = getCookie("token") !== null;

  if (!isLoggedIn) {
    localStorage.clear();
    sessionStorage.clear();
    return redirect("/login");
  }

  return null;
};

export default function HomeView() {
  const location = useLocation();
  const navigate = useNavigate();
  console.log('[HomeView] 🏠 RENDER — location.pathname:', location.pathname);
  const sessionManagerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [userHasTicketAccess, setUserHasTicketAccess] = useState(false);
  const [userIsSuperAdmin, setUserIsSuperAdmin] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);
  const [servicesSearch, setServicesSearch] = useState("");
  const [headerServices, setHeaderServices] = useState([]);
  const [, setServicesLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userOrgName, setUserOrgName] = useState(null);

  // Local UI metadata for each service (icons, descriptions, paths, etc.)
  // These fields are not returned by the API and are needed for rendering.
  const serviceUIMeta = {
    organization: { description: "Manage multiple business accounts under one payer account with centralized billing, tax settings, and member management", path: "/admin/organization", icon: userCatalogInactiveIcon, iconBg: "#E1BEE7", pricing: "Request access" },
    ticketing:    { description: "Full event ticketing system with box office, QR code scanning, attendee management, and real-time sales tracking", path: "/admin/my-tickets", icon: myTicketsInactiveIcon, iconBg: "#FFCDD2", pricing: "Included" },
    analytics:    { description: "Business performance dashboards with revenue tracking, customer insights, event metrics, and growth trends", path: "/admin/analytics", icon: analyticsInactiveIcon, iconBg: "#BBDEFB", pricing: "Included" },
    events:       { description: "Create, promote, and manage events and advertisements with scheduling, targeting, and audience reach tools", path: "/admin/my-events", icon: myEventsInactiveIcon, iconBg: "#C8E6C9", pricing: "Included" },
    business:     { description: "Manage your business profile, location, hours, photos, menus, and public-facing information", path: "/admin/my-business", icon: clientCatalogInactiveIcon, iconBg: "#FFE0B2", pricing: "Included" },
    shop:         { description: "Set up and manage your online storefront with product listings, inventory, orders, and payment processing", path: "/admin/shop", icon: shopInactiveIcon, iconBg: "#B2DFDB", pricing: "$29/month" },
    team:         { description: "Invite team members, assign roles and permissions, and manage access to your business tools", path: "/admin/configuration#team", icon: teamInactiveIcon, iconBg: "#D1C4E9", pricing: "Included" },
    configuration:{ description: "App settings, notification preferences, integrations, and account-level configuration options", path: "/admin/configuration", icon: configurationInactiveIcon, iconBg: "#CFD8DC", pricing: "Included" },
    "market-intelligence": { description: "University event intelligence platform with KPI tracking, AI recommendations, and sponsorship ROI dashboards", path: "/admin/service/market-intelligence", icon: analyticsInactiveIcon, iconBg: "#B3E5FC", pricing: "$1,299/month" },
    "ai_agent_starter": { description: "Automated AI agents that discover, extract, and create draft events from trusted sources 24/7", path: "/admin/ai-agents", icon: aiDiscoveryInactiveIcon, iconBg: "#EBF5FF", pricing: "Free" },
    "ai_agent_pro": { description: "Automated AI agents that discover, extract, and create draft events from trusted sources 24/7", path: "/admin/ai-agents", icon: aiDiscoveryInactiveIcon, iconBg: "#EBF5FF", pricing: "Free" },
    "ai_agent_enterprise": { description: "Automated AI agents that discover, extract, and create draft events from trusted sources 24/7", path: "/admin/ai-agents", icon: aiDiscoveryInactiveIcon, iconBg: "#EBF5FF", pricing: "Free" },
    "experiences": { description: "Raffles, live polls, trivia, and interactive engagement tools for your events", path: "/admin/experiences", icon: experiencesInactiveIcon, iconBg: "#FFF3E0", pricing: "Included" },
  };

  // Fetch entitlements from the API on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let cancelled = false;
    const fetchServices = async () => {
      try {
        setServicesLoading(true);
        const data = await getMyServices();
        if (cancelled) return;
        const services = (data.services || []).map((svc) => {
          const meta = serviceUIMeta[svc.serviceId] || {};
          return {
            id: svc.serviceId,
            name: svc.name,
            type: svc.type,
            status: svc.status,
            subscribed: svc.subscribed,
            description: meta.description || "",
            path: meta.path || `/admin/${svc.serviceId}`,
            icon: meta.icon || null,
            iconBg: meta.iconBg || "#E0E0E0",
            pricing: svc.subscribed ? (svc.type === "free" ? "Included" : (meta.pricing || "")) : (meta.pricing || ""),
          };
        });
        // Ensure Market Intelligence always appears in the panel
        if (!services.find((s) => s.id === "market-intelligence")) {
          const miMeta = serviceUIMeta["market-intelligence"];
          services.push({
            id: "market-intelligence",
            name: "Market Intelligence",
            type: "paid",
            status: "available",
            subscribed: false,
            description: miMeta.description,
            path: miMeta.path,
            icon: miMeta.icon,
            iconBg: miMeta.iconBg,
            pricing: miMeta.pricing,
          });
        }
        // Consolidate all ai_agent_* entries into a single "AI Agents" entry.
        // AI Agent access is now plan-based (included with subscription), not a separate purchase.
        // Remove individual ai_agent_* entries
        const filteredServices = services.filter((s) => !(s.id && s.id.startsWith("ai_agent_")));
        // Add single consolidated AI Agents entry
        const aiMeta = serviceUIMeta["ai_agent_starter"];
        filteredServices.push({
          id: "ai_agents",
          name: "AI Agents",
          type: "included",
          status: "active",
          subscribed: true,
          description: aiMeta.description,
          path: aiMeta.path,
          icon: aiMeta.icon,
          iconBg: aiMeta.iconBg,
          pricing: "Included",
        });
        setHeaderServices(filteredServices);
      } catch (error) {
        console.error("Failed to load entitlements:", error);
        // On error, leave headerServices empty so the UI degrades gracefully
      } finally {
        if (!cancelled) setServicesLoading(false);
      }
    };
    fetchServices();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch user's organization to gate org-restricted nav items
  useEffect(() => {
    let cancelled = false;
    const fetchOrg = async () => {
      try {
        const res = await getMyOrganizations();
        if (cancelled) return;
        const orgs = res?.data?.organizations || res?.data || [];
        if (orgs.length > 0) {
          setUserOrgName(orgs[0].name || null);
        }
      } catch {
        // Not in an org — that's fine
      }
    };
    fetchOrg();
    return () => { cancelled = true; };
  }, []);

  const searchResults = headerSearch.trim()
    ? headerServices.filter((s) =>
        s.name.toLowerCase().includes(headerSearch.toLowerCase()) ||
        s.description.toLowerCase().includes(headerSearch.toLowerCase())
      )
    : [];

  // Check ticket access and super admin status on component mount
  useEffect(() => {
    const checkTicketAccess = () => {
      const hasAccess = hasMyTicketsAccess();
      setUserHasTicketAccess(hasAccess);
      console.log('🎫 User has My Tickets access:', hasAccess);
    };

    const checkSuperAdmin = () => {
      const isAdmin = isSuperAdmin();
      setUserIsSuperAdmin(isAdmin);
      console.log('👑 User is super admin:', isAdmin);
    };

    checkTicketAccess();
    checkSuperAdmin();
  }, []);

  // Get user role from token
  const getUserRole = () => {
    try {
      const idToken = localStorage.getItem('idToken');
      if (!idToken) return null;
      
      const tokenPayload = JSON.parse(atob(idToken.split('.')[1]));
      return tokenPayload['custom:role'];
    } catch (error) {
      console.error('Error parsing token:', error);
      return null;
    }
  };

  // Filter options based on user access
  const getFilteredOptions = () => {
    const userRole = getUserRole();
    const isVerifier = userRole === 'verifier' || userRole === 'scanner';
    
    console.log('🔐 User role:', userRole, 'isVerifier:', isVerifier);

    return options.filter(option => {
      // Verifiers should not see any main navigation items
      if (isVerifier) {
        return false;
      }

      // Hide My Tickets if user doesn't have access
      if (option.title === "My Tickets" && !userHasTicketAccess) {
        return false;
      }

      // Hide services that require a subscription the user doesn't have
      if (option.requiresServiceId) {
        const svc = headerServices.find(s => s.id === option.requiresServiceId);
        if (!svc || !svc.subscribed) return false;
      }

      // Hide org-restricted items for users not in the required org
      if (option.requiresOrg && option.requiresOrg !== userOrgName) {
        return false;
      }

      // Hide other restricted items (should be in bottom section only)
      return !["Logout", "Configuration", "Team Management"].includes(option.title);
    });
  };

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const logoutFn = () => {
    setIsLoading(true);
    sessionManagerRef.current?.clearAllTimers();
    localStorage.clear();
    sessionStorage.clear();
    setTimeout(() => {
      setIsLoading(false);
      navigate("/login");
    }, 1000);
  };

  useEffect(() => {
    const selectedMenuOption = options.find(
      (x) => x.path.substring(1) === location.pathname.split("/")[1].split("-")
    );
    const title = ["My Tabs", selectedMenuOption?.title, ...location.pathname.split("/").slice(2)];
    document.title = title.filter((x) => x).join(" - ");
  }, [location.pathname]);

  // On mobile (<= 768px), the sidebar is an overlay drawer. Auto-close it
  // whenever the route changes so a tap on a nav link closes the drawer
  // (otherwise it stays open covering the page the user just navigated to).
  // On desktop the sidebar's open/closed state is just a width toggle, so
  // we leave it alone there.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
      setIsExpanded(false);
    }
  }, [location.pathname]);

  return (
    <UserDataProvider>
      <SessionManager ref={sessionManagerRef} />
      {isLoading ? (
        <MTBLoading />
      ) : (
        <div className='HomeView'>
          {/* Mobile-only backdrop. Visible when the drawer is open on small
              viewports; tapping it closes the drawer. CSS hides it ≥ 769px. */}
          {isExpanded && (
            <div
              className='SidebarBackdrop'
              onClick={() => setIsExpanded(false)}
              aria-hidden="true"
            />
          )}
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
                  marginTop: "8px",
                  borderRadius: "10px",
                }}
              >
                {getFilteredOptions().map((item) => {
                    const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                    return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={() =>
                        !active ? "Menu-option-expanded" : "Menu-option"
                      }
                      children={() => (
                        <>
                          <div style={{ display: active ? 'block' : 'none' }}>
                            <ReactSVG src={item.icon.active} />
                          </div>
                          <div style={{ display: active ? 'none' : 'block' }}>
                            <ReactSVG src={item.icon.inactive} />
                          </div>
                          {isExpanded && <span style={{marginLeft: "8px"}}>{item.title}</span>}
                        </>
                      )}
                    />
                    );
                  })}
              </div>
              <div style={{display: "flex", flex: 4}}></div>

              <div
                style={{
                  display: "flex",
                  flex: 3,
                  paddingTop: "16px",
                  alignContent: "center",
                }}
              >
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
                  <div
                    onClick={() => setShowLogoutConfirm(true)}
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      backgroundColor: !isExpanded ? null : "white",
                      borderRadius: "10px",
                    }}
                    className={isExpanded ? "Menu-option" : "Menu-option-expanded"}
                  >
                    <ReactSVG src={options[options.length - 1].icon} />
                    {isExpanded && (
                      <span style={{marginLeft: "8px", backgroundColor: "white", fontWeight: 500}}>
                        {options[options.length - 1].title}
                      </span>
                    )}
                  </div>

                  {!getUserRole() || (getUserRole() !== 'verifier' && getUserRole() !== 'scanner') ? (
                    <>
                      <NavLink
                        key="/admin/configuration"
                        style={{
                          backgroundColor: !isExpanded ? null : "white",
                          fontFamily: "Poppins",
                          fontWeight: 500,
                        }}
                        className={isExpanded ? "Menu-option" : "Menu-option-expanded"}
                        to="/admin/configuration"
                        children={({isActive}) => (
                          <>
                            <div style={{ display: isActive ? 'block' : 'none' }}>
                              <ReactSVG src={configurationActiveIcon} />
                            </div>
                            <div style={{ display: isActive ? 'none' : 'block' }}>
                              <ReactSVG src={configurationInactiveIcon} />
                            </div>
                            {isExpanded && (
                              <span style={{marginLeft: "8px", backgroundColor: "white", fontWeight: 500}}>
                                Configuration
                              </span>
                            )}
                          </>
                        )}
                      />
                    </>
                  ) : null}
                  {userIsSuperAdmin && (
                    <NavLink
                      key="/admin/admin-portal"
                      style={{
                        backgroundColor: !isExpanded ? null : "white",
                        fontFamily: "Poppins",
                        fontWeight: 500,
                      }}
                      className={isExpanded ? "Menu-option" : "Menu-option-expanded"}
                      to="/admin/admin-portal"
                      children={({isActive}) => (
                        <>
                          <div style={{ display: isActive ? 'block' : 'none' }}>
                            <ReactSVG src={upgradesAddonsActiveIcon} />
                          </div>
                          <div style={{ display: isActive ? 'none' : 'block' }}>
                            <ReactSVG src={upgradesAddonsInactiveIcon} />
                          </div>
                          {isExpanded && (
                            <span style={{marginLeft: "8px", backgroundColor: "white", fontWeight: 500}}>
                              Admin Portal
                            </span>
                          )}
                        </>
                      )}
                    />
                  )}
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
            <div className='TopHeader'>
              <div className='TopHeaderLeft'>
                <button
                  className='TopHeaderHamburger'
                  type="button"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  aria-label={isExpanded ? "Close menu" : "Open menu"}
                  aria-expanded={isExpanded}
                >
                  <span className='TopHeaderHamburgerBars' aria-hidden="true">
                    <span></span><span></span><span></span>
                  </span>
                </button>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <button
                    className='TopHeaderServicesBtn'
                    onClick={() => setServicesOpen((prev) => !prev)}
                    title="Tabs Services"
                  >
                    <span>⊞</span>
                  </button>
                  {servicesOpen && (
                    <>
                      <div className='TopHeaderSearchOverlay' onClick={() => setServicesOpen(false)} />
                      <div className='TopHeaderServicesDropdown'>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #f0f0f0" }}>
                          <span style={{ fontFamily: "Outfit", fontSize: 16, fontWeight: 600, color: "#1a1a1a" }}>Tabs Services</span>
                          <button onClick={() => setServicesOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#71727A", fontSize: 18 }}>✕</button>
                        </div>
                        <div style={{ padding: "8px 16px" }}>
                          <div className='TopHeaderSearch' style={{ margin: 0, maxWidth: "100%", minWidth: 0 }}>
                            <span className='TopHeaderSearchIcon'>🔍</span>
                            <input
                              className='TopHeaderSearchInput'
                              placeholder="Search services..."
                              value={servicesSearch}
                              onChange={(e) => setServicesSearch(e.target.value)}
                              autoFocus
                            />
                          </div>
                        </div>
                        <div style={{ maxHeight: 400, overflowY: "auto", padding: "8px 0" }}>
                          {(() => {
                            const filtered = headerServices.filter((s) => {
                              if (!servicesSearch.trim()) return true;
                              const q = servicesSearch.toLowerCase();
                              return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
                            });
                            const categories = [...new Set(filtered.map((s) => {
                              if (["organization", "business", "team"].includes(s.id)) return "Management";
                              if (["ticketing", "shop"].includes(s.id)) return "Sales";
                              if (["events", "ai_agents"].includes(s.id)) return "Marketing";
                              if (["analytics", "market-intelligence"].includes(s.id)) return "Insights";
                              if (["experiences"].includes(s.id)) return "Engagement";
                              return "Settings";
                            }))];
                            const getCategory = (s) => {
                              if (["organization", "business", "team"].includes(s.id)) return "Management";
                              if (["ticketing", "shop"].includes(s.id)) return "Sales";
                              if (["events", "ai_agents"].includes(s.id)) return "Marketing";
                              if (["analytics", "market-intelligence"].includes(s.id)) return "Insights";
                              if (["experiences"].includes(s.id)) return "Engagement";
                              return "Settings";
                            };
                            return categories.map((cat) => (
                              <div key={cat}>
                                <div style={{ fontFamily: "Outfit", fontSize: 11, fontWeight: 600, color: "#71727A", textTransform: "uppercase", letterSpacing: 0.5, padding: "8px 16px 4px" }}>{cat}</div>
                                {filtered.filter((s) => getCategory(s) === cat).map((s) => (
                                  <button
                                    key={s.id}
                                    className='TopHeaderSearchResult'
                                    style={{ margin: "0 8px 4px", width: "calc(100% - 16px)", borderRadius: 8 }}
                                    onClick={() => {
                                      if (s.subscribed) {
                                        navigate(s.path);
                                      } else {
                                        navigate(`/admin/service/${s.id}`);
                                      }
                                      setServicesOpen(false);
                                      setServicesSearch("");
                                    }}
                                  >
                                    <div className='TopHeaderSearchResultIcon' style={{ background: s.iconBg }}>
                                      <ReactSVG src={s.icon} style={{ width: 20, height: 20 }} />
                                    </div>
                                    <div className='TopHeaderSearchResultInfo'>
                                      <span className='TopHeaderSearchResultName'>{s.name}</span>
                                      <span className='TopHeaderSearchResultDesc'>{s.description}</span>
                                    </div>
                                    {s.subscribed && (
                                      <span style={{ marginLeft: "auto", fontSize: 11, fontFamily: "Outfit", fontWeight: 600, color: "#2E7D32", background: "#E8F5E9", padding: "2px 8px", borderRadius: 4, whiteSpace: "nowrap" }}>Active</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className='TopHeaderSearch'>
                <span className='TopHeaderSearchIcon'>🔍</span>
                <input
                  className='TopHeaderSearchInput'
                  placeholder="Search services, features..."
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                  onFocus={() => setHeaderSearchOpen(true)}
                />
                {headerSearch && (
                  <button
                    className='TopHeaderSearchClear'
                    onClick={() => { setHeaderSearch(""); setHeaderSearchOpen(false); }}
                  >
                    ✕
                  </button>
                )}
                <span className='TopHeaderShortcut'>[Alt+S]</span>
                {headerSearchOpen && headerSearch.trim() && (
                  <>
                    <div className='TopHeaderSearchOverlay' onClick={() => setHeaderSearchOpen(false)} />
                    <div className='TopHeaderSearchDropdown'>
                      <div className='TopHeaderSearchSidebar'>
                        <button className='TopHeaderSearchSidebarItem TopHeaderSearchSidebarItemActive'>Services</button>
                        <a
                          className='TopHeaderSearchSidebarItem'
                          href="https://help.keeptabs.app"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setHeaderSearchOpen(false)}
                        >
                          Documentation ↗
                        </a>
                      </div>
                      <div className='TopHeaderSearchResults'>
                        <h3 className='TopHeaderSearchResultsTitle'>Services</h3>
                        {searchResults.length > 0 ? (
                          searchResults.map((s) => (
                            <button
                              key={s.id}
                              className='TopHeaderSearchResult'
                              onClick={() => {
                                if (s.subscribed) {
                                  navigate(s.path);
                                } else {
                                  navigate(`/admin/service/${s.id}`);
                                }
                                setHeaderSearch("");
                                setHeaderSearchOpen(false);
                              }}
                            >
                              <div className='TopHeaderSearchResultIcon' style={{ background: s.iconBg }}>
                                <ReactSVG src={s.icon} style={{ width: 22, height: 22 }} />
                              </div>
                              <div className='TopHeaderSearchResultInfo'>
                                <span className='TopHeaderSearchResultName'>{s.name}</span>
                                <span className='TopHeaderSearchResultDesc'>{s.description}</span>
                                <span style={{
                                  fontFamily: "Outfit",
                                  fontSize: 11,
                                  marginTop: 4,
                                  color: s.subscribed ? "#2E7D32" : "#F09925",
                                  fontWeight: 500,
                                }}>
                                  {s.subscribed ? "✓ Active" : s.pricing}
                                </span>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className='TopHeaderSearchEmpty'>No results found</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className='TopHeaderRight'>
                <TopHeaderProfile onSignOut={() => setShowLogoutConfirm(true)} />
              </div>
            </div>
            <div className='ViewContent'>
              <Outlet key={location.key} />
            </div>
          </div>
        </div>
      )}
      <Dialog open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} PaperProps={{ sx: { borderRadius: '16px', padding: '8px', maxWidth: '380px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' } }}>
        <DialogTitle sx={{ fontFamily: 'Outfit, sans-serif', fontSize: '18px', fontWeight: 600, color: '#111827', padding: '20px 24px 8px' }}>Log Out</DialogTitle>
        <DialogContent sx={{ padding: '12px 24px' }}>
          <Typography sx={{ fontFamily: 'Outfit, sans-serif', fontSize: '14px', color: '#6B7280' }}>Are you sure you want to log out?</Typography>
        </DialogContent>
        <DialogActions sx={{ padding: '12px 24px 20px', gap: '12px' }}>
          <Button
            onClick={() => setShowLogoutConfirm(false)}
            variant="outlined"
            sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px', borderRadius: '8px', padding: '8px 20px', color: '#6B7280', borderColor: '#E5E7EB', '&:hover': { backgroundColor: '#F9FAFB', borderColor: '#D1D5DB' } }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setShowLogoutConfirm(false);
              logoutFn();
            }}
            variant="contained"
            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '14px', borderRadius: '8px', padding: '8px 20px', backgroundColor: '#4F46E5', '&:hover': { backgroundColor: '#4338CA' } }}
            disableElevation
          >
            Log Out
          </Button>
        </DialogActions>
      </Dialog>
    </UserDataProvider>
  );
}
