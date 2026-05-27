import React, { useEffect, useState } from "react";
import styles from "./OrganizationList.module.css";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CorporateFareIcon from "@mui/icons-material/CorporateFare";
import AddIcon from "@mui/icons-material/Add";
import { useNavigate } from "react-router-dom";
import { getMyOrganizations } from "../../services/organizationService";
import { getMyServices } from "../../services/entitlementService";
import { createMultipleClasses } from "../../utils/common";
import { toast } from "react-toastify";

const OrganizationList = () => {
  const [, setIsLoading] = useState(true);
  const [, setHasOrg] = useState(false);
  const [hasEntitlement, setHasEntitlement] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        setIsLoading(true);

        // Check if user has the organization entitlement
        const entitlements = await getMyServices();
        const orgService = (entitlements.services || []).find(
          (s) => s.serviceId === "organization"
        );
        if (!orgService || !orgService.subscribed) {
          setHasEntitlement(false);
          setIsLoading(false);
          return;
        }
        setHasEntitlement(true);

        // Check if user already has an organization
        const res = await getMyOrganizations();
        const orgs = res.data?.organizations || res.data || [];
        if (orgs.length > 0) {
          navigate(`/admin/organization/${orgs[0].organizationId || orgs[0].id}`, { replace: true });
        } else {
          setHasOrg(false);
        }
      } catch (err) {
        console.error("Failed to check organization:", err);
        toast.error("Failed to load organization");
        setHasOrg(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkAccess();
  }, [navigate]);

  const handleDesignate = () => {
    toast.info("Designate flow coming soon — select a business to convert.");
  };

  // Suspense fallback already covers chunk load. Skip the second spinner
  // and render the shell immediately.
  // (Was: if (isLoading) return <MTBLoading />.)

  // Not subscribed — redirect to the service landing page
  if (!hasEntitlement) {
    return (
      <div className={styles.view}>
        <div className={styles.contentContainer}>
          <div className={styles.titleContainer}>
            <h1>Organization</h1>
          </div>
          <div className={styles.tableContainer}>
            <div className={styles.emptyState}>
              <LockOutlinedIcon
                className={styles.emptyIcon}
                sx={{ fontSize: 64, color: "#9E9E9E" }}
              />
              <p className={styles.emptyTitle}>Access Required</p>
              <p className={styles.emptySubtitle}>
                You need to be approved for the Organization service before you can access this page.
              </p>
              <button
                className={createMultipleClasses([
                  styles.baseButton,
                  styles.designateButton,
                ])}
                onClick={() => navigate("/admin/service/organization")}
              >
                Request Access
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Only shows if user has NO organization — prompt to create one
  return (
    <div className={styles.view}>
      <div className={styles.contentContainer}>
        <div className={styles.titleContainer}>
          <h1>Organization</h1>
        </div>
        <div className={styles.tableContainer}>
          <div className={styles.emptyState}>
            <CorporateFareIcon
              className={styles.emptyIcon}
              sx={{ fontSize: 64 }}
            />
            <p className={styles.emptyTitle}>No organization yet</p>
            <p className={styles.emptySubtitle}>
              Designate one of your existing business accounts as an organization
              to manage multiple businesses, members, and shared tax settings
              under a single payer account.
            </p>
            <button
              className={createMultipleClasses([
                styles.baseButton,
                styles.designateButton,
              ])}
              onClick={handleDesignate}
            >
              <AddIcon fontSize="small" />
              Designate as Organization
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrganizationList;
