import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { MTBComingSoon } from "../../components";
import { getMyServices } from "../../services/entitlementService";

const ShopView = () => {
  const [, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const data = await getMyServices();
        const shopService = (data.services || []).find(
          (s) => s.serviceId === "shop"
        );
        setHasAccess(shopService?.subscribed === true);
      } catch (err) {
        console.error("Failed to check shop entitlement:", err);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkAccess();
  }, []);

  // Suspense fallback already covers chunk load. Don't render a second
  // full-page spinner on top.

  if (!hasAccess) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: 32 }}>
        <LockOutlinedIcon sx={{ fontSize: 64, color: "#9E9E9E", marginBottom: 2 }} />
        <h2 style={{ margin: '8px 0', color: '#1D1B20' }}>Access Required</h2>
        <p style={{ color: '#71727A', maxWidth: 400, marginBottom: 20 }}>
          You need an active Tabs Shops subscription to access this page.
        </p>
        <button
          onClick={() => navigate("/admin/service/shop")}
          style={{
            padding: '12px 32px', borderRadius: 24, border: 'none',
            background: '#F09925', color: '#fff', fontSize: 16,
            fontWeight: 600, cursor: 'pointer',
          }}
        >
          Subscribe to Tabs Shops
        </button>
      </div>
    );
  }

  return <MTBComingSoon />;
};

export default ShopView;
