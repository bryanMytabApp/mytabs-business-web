import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReactSVG } from "react-svg";
import styles from "./ServicesPanel.module.css";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

import organizationIcon from "../../assets/menu/userCatalogInactive.svg";
import ticketingIcon from "../../assets/menu/ticketInactive.svg";
import analyticsIcon from "../../assets/menu/analyticsInactive.svg";
import eventsIcon from "../../assets/menu/myEventsInactive.svg";
import businessIcon from "../../assets/menu/clientCatalogInactive.svg";
import teamIcon from "../../assets/menu/teamInactive.svg";
import configurationIcon from "../../assets/menu/configurationInactive.svg";
import shopIcon from "../../assets/menu/shopInactive.svg";

const services = [
  {
    id: "organization",
    name: "Tabs Organizations",
    description: "Manage multiple business accounts under one payer",
    icon: organizationIcon,
    path: "/admin/organization",
    category: "Management",
  },
  {
    id: "ticketing",
    name: "Tabs Ticketing",
    description: "Add event ticketing and box office to your account",
    icon: ticketingIcon,
    path: "/admin/my-tickets",
    category: "Sales",
  },
  {
    id: "analytics",
    name: "Tabs Analytics",
    description: "View business performance and insights",
    icon: analyticsIcon,
    path: "/admin/analytics",
    category: "Insights",
  },
  {
    id: "events",
    name: "Tabs Events & Ads",
    description: "Create and manage events and advertisements",
    icon: eventsIcon,
    path: "/admin/my-events",
    category: "Marketing",
  },
  {
    id: "business",
    name: "Tabs Business",
    description: "Manage your business profile and settings",
    icon: businessIcon,
    path: "/admin/my-business",
    category: "Management",
  },
  {
    id: "configuration",
    name: "Tabs Configuration",
    description: "App settings and preferences",
    icon: configurationIcon,
    path: "/admin/configuration",
    category: "Settings",
  },
  {
    id: "shop",
    name: "Tabs Shops",
    description: "Set up and manage your online storefront",
    icon: shopIcon,
    path: "/admin/shop",
    category: "Sales",
  },
  {
    id: "market-intelligence",
    name: "Market Intelligence",
    description: "University event intelligence platform with KPI tracking and AI recommendations",
    icon: analyticsIcon,
    path: "/admin/service/market-intelligence",
    category: "Insights",
  },
];

const ServicesPanel = ({ open, onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  if (!open) return null;

  const filtered = services.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
    );
  });

  const categories = [...new Set(filtered.map((s) => s.category))];

  const handleServiceClick = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.panel}>
        <div className={styles.header}>
          <h2 className={styles.title}>Tabs Services</h2>
          <button className={styles.closeButton} onClick={onClose}>
            <CloseIcon fontSize="small" />
          </button>
        </div>

        <div className={styles.searchContainer}>
          <SearchIcon fontSize="small" sx={{ color: "#8F8F8F" }} />
          <input
            className={styles.searchInput}
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className={styles.servicesList}>
          {categories.map((category) => (
            <div key={category} className={styles.categorySection}>
              <h3 className={styles.categoryTitle}>{category}</h3>
              <div className={styles.servicesGrid}>
                {filtered
                  .filter((s) => s.category === category)
                  .map((service) => {
                    return (
                      <button
                        key={service.id}
                        className={styles.serviceCard}
                        onClick={() => handleServiceClick(service.path)}
                      >
                        <ReactSVG src={service.icon} className={styles.serviceIcon} />
                        <div className={styles.serviceInfo}>
                          <span className={styles.serviceName}>{service.name}</span>
                          <span className={styles.serviceDesc}>{service.description}</span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className={styles.emptyText}>No services match your search.</p>
          )}
        </div>
      </div>
    </>
  );
};

export default ServicesPanel;
