import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./OrganizationDashboard.module.css";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import SearchIcon from "@mui/icons-material/Search";
import FolderIcon from "@mui/icons-material/Folder";
import SettingsIcon from "@mui/icons-material/Settings";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LinkIcon from "@mui/icons-material/Link";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  getOrganization,
  getOrganizationBusinesses,
  getOrganizationMembers,
  unlinkBusiness,
  deleteOrganization,
  removeMember,
  changeMemberRole,
} from "../../services/organizationService";
import { createMultipleClasses } from "../../utils/common";
import { toast } from "react-toastify";
import { MTBLoading } from "../../components";
import AddMemberModal from "./AddMemberModal";
import TaxOverrideModal from "./TaxOverrideModal";
import CreateBusinessModal from "./CreateBusinessModal";


const OrganizationDashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [org, setOrg] = useState(null);
  const [businesses, setBusinesses] = useState([]);
  const [members, setMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState("member");

  // UI state
  const [viewMode, setViewMode] = useState("hierarchy"); // "hierarchy" | "list"
  const [searchQuery, setSearchQuery] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [selectedItems, setSelectedItems] = useState(new Set());

  // Modals
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [taxOverrideModal, setTaxOverrideModal] = useState({ open: false, business: null });
  const [createBusinessModalOpen, setCreateBusinessModalOpen] = useState(false);

  const actionsRef = useRef(null);

  // Calculate business limit from subscription (based on $50/business pricing)
  const getBusinessLimit = () => {
    if (!org) return 0;
    // If org has subscription amount stored, calculate from that
    // Otherwise use linkedBusinessCount as a fallback indicator
    // For now, we'll show the count vs a reasonable default
    return org.businessLimit || 250; // Default max if no limit set
  };
  const businessLimit = getBusinessLimit();
  const businessesUsed = businesses.length;
  const canAddMore = businessesUsed < businessLimit;

  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";
  const isOwner = userRole === "owner";

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [orgRes, bizRes, memRes] = await Promise.all([
        getOrganization(id),
        getOrganizationBusinesses(id),
        getOrganizationMembers(id),
      ]);
      setOrg(orgRes.data);
      setBusinesses(bizRes.data?.businesses || bizRes.data || []);
      const membersList = memRes.data?.members || memRes.data || [];
      setMembers(membersList);

      const currentUserId = localStorage.getItem("userId");
      const currentMember = membersList.find((m) => m.userId === currentUserId);
      if (currentMember) {
        setUserRole(currentMember.role);
      } else if (orgRes.data?.userRole) {
        setUserRole(orgRes.data.userRole);
      } else {
        setUserRole("member");
      }
    } catch (err) {
      console.error("Failed to load organization:", err);
      toast.error("Failed to load organization details");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const refreshBusinesses = async () => {
    try {
      const res = await getOrganizationBusinesses(id);
      setBusinesses(res.data?.businesses || res.data || []);
    } catch (err) {
      console.error("Failed to refresh businesses:", err);
    }
  };

  const refreshMembers = async () => {
    try {
      const res = await getOrganizationMembers(id);
      setMembers(res.data?.members || res.data || []);
    } catch (err) {
      console.error("Failed to refresh members:", err);
    }
  };

  // Delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteLinkedBusinesses, setDeleteLinkedBusinesses] = useState(false);

  const handleDeleteOrg = async () => {
    try {
      setIsDeleting(true);
      await deleteOrganization(id, deleteLinkedBusinesses);
      toast.success("Organization deleted");
      setDeleteModalOpen(false);
      // Full reload to refresh sidebar/services state
      window.location.href = "/admin/organization/";
    } catch (err) {
      toast.error("Failed to delete organization");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const toggleSelect = (itemId) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // Filter businesses by search
  const filteredBusinesses = businesses.filter((biz) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (biz.name && biz.name.toLowerCase().includes(q)) ||
      (biz.linkedBusinessId && biz.linkedBusinessId.toLowerCase().includes(q))
    );
  });

  // Also check if root matches search
  const rootMatchesSearch = !searchQuery.trim() ||
    (org?.name && org.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (id && id.toLowerCase().includes(searchQuery.toLowerCase()));

  // Suspense fallback already covers chunk load. Skip the second spinner
  // and render the shell immediately.
  // (Was: if (isLoading) return <MTBLoading />.)

  return (
    <div className={styles.view}>
      <div className={styles.contentContainer}>
        {/* Header */}
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <button className={styles.backButton} onClick={() => navigate("/admin/organization/")}>
              <ArrowBackIcon />
            </button>
            <h1 className={styles.headerTitle}>Organization Dashboard</h1>
          </div>

          <div className={styles.headerRight}>
            {isOwnerOrAdmin && (
              <span style={{ fontSize: 13, color: '#71727A', marginRight: 12, fontFamily: 'Outfit' }}>
                {businessesUsed}/{businessLimit} businesses
              </span>
            )}
            {isOwnerOrAdmin && canAddMore && (
              <button
                className={styles.addAccountButton}
                onClick={() => setCreateBusinessModalOpen(true)}
              >
                + Add account
              </button>
            )}
            {isOwnerOrAdmin && !canAddMore && (
              <span style={{ fontSize: 12, color: '#E65100', fontWeight: 600, marginRight: 12 }}>
                Business limit reached
              </span>
            )}

            {isOwnerOrAdmin && (
              <div className={styles.actionsWrapper} ref={actionsRef}>
                <button
                  className={styles.actionsButton}
                  onClick={() => setActionsOpen((prev) => !prev)}
                >
                  Actions
                  <ArrowDropDownIcon fontSize="small" />
                </button>
              {actionsOpen && (
                <>
                  <div
                    className={styles.dropdownOverlay}
                    onClick={() => setActionsOpen(false)}
                  />
                  <div className={styles.actionsMenu}>
                    <button
                      className={styles.actionsMenuItem}
                      onClick={() => { setActionsOpen(false); setCreateBusinessModalOpen(true); }}
                    >
                      <LinkIcon fontSize="small" />
                      Add Business Account
                    </button>
                    <button
                      className={styles.actionsMenuItem}
                      onClick={() => { setActionsOpen(false); setAddMemberModalOpen(true); }}
                    >
                      <PersonAddIcon fontSize="small" />
                      Add Member
                    </button>
                    <button
                      className={styles.actionsMenuItem}
                      onClick={() => {
                        setActionsOpen(false);
                        setTaxOverrideModal({ open: true, business: null });
                      }}
                    >
                      <ReceiptLongIcon fontSize="small" />
                      Set Tax
                    </button>
                    {isOwner && (
                      <button
                        className={createMultipleClasses([styles.actionsMenuItem, styles.actionsMenuItemDanger])}
                        onClick={() => { setActionsOpen(false); setDeleteModalOpen(true); }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                        Delete Organization
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          </div>
        </div>

        {/* Description */}
        <p className={styles.descriptionText}>
          Organizational units enable you to group several accounts together and administer them as a single unit instead of one at a time.
        </p>

        {/* Panels row — side by side */}
        <div className={styles.panelsRow}>

        {/* Main panel */}
        <div className={styles.panel}>
          {/* Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.searchContainer}>
              <span><SearchIcon fontSize="small" /></span>
              <input
                className={styles.searchInput}
                placeholder="Search by name, email, account ID or OU ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className={styles.viewToggle}>
              <button
                className={createMultipleClasses([
                  styles.toggleButton,
                  viewMode === "hierarchy" ? styles.toggleButtonActive : "",
                ])}
                onClick={() => setViewMode("hierarchy")}
              >
                Hierarchy
              </button>
              <button
                className={createMultipleClasses([
                  styles.toggleButton,
                  viewMode === "list" ? styles.toggleButtonActive : "",
                ])}
                onClick={() => setViewMode("list")}
              >
                List
              </button>
            </div>
          </div>

          {viewMode === "hierarchy" ? (
            <>
              {/* Column headers */}
              <div className={styles.columnHeaders}>
                <span>Organizational structure</span>
                <span>Account created / joined date</span>
              </div>

              {/* Tree view */}
              <div className={styles.treeContainer}>
                {/* Root node — payer account */}
                {rootMatchesSearch && (
                  <div className={createMultipleClasses([styles.treeNode, styles.treeNodeRoot])}>
                    <input
                      type="checkbox"
                      className={styles.treeCheckbox}
                      checked={selectedItems.has("root")}
                      onChange={() => toggleSelect("root")}
                    />
                    <button
                      className={styles.expandButton}
                      onClick={() => setExpanded((prev) => !prev)}
                    >
                      {expanded ? (
                        <ExpandMoreIcon fontSize="small" />
                      ) : (
                        <ChevronRightIcon fontSize="small" />
                      )}
                    </button>
                    <span className={styles.nodeIcon}>
                      <FolderIcon fontSize="small" />
                    </span>
                    <div className={styles.nodeInfo}>
                      <div className={styles.nodeName}>
                        {org?.name || "Organization"}
                        <span className={styles.payerBadge}>payer account</span>
                      </div>
                      <div className={styles.nodeId}>{org?.orgCode || 'ORG-...'}</div>
                    </div>
                    <div className={styles.nodeDate}>
                      {formatDate(org?.createdAt)}
                    </div>
                  </div>
                )}

                {/* Child nodes — linked businesses */}
                {expanded && filteredBusinesses.map((biz, idx) => (
                  <div
                    key={biz.linkedBusinessId}
                    className={createMultipleClasses([styles.treeNode, styles.treeNodeChild])}
                  >
                    {/* Connector line for non-last items */}
                    {idx < filteredBusinesses.length - 1 && (
                      <div className={styles.connectorLine} />
                    )}
                    <input
                      type="checkbox"
                      className={styles.treeCheckbox}
                      checked={selectedItems.has(biz.linkedBusinessId)}
                      onChange={() => toggleSelect(biz.linkedBusinessId)}
                    />
                    <span className={styles.nodeChildIcon}>
                      <SettingsIcon fontSize="small" />
                    </span>
                    <div className={styles.nodeInfo}>
                      <div className={styles.nodeName}>
                        <span
                          style={{ cursor: 'pointer', color: '#1976D2', textDecoration: 'none' }}
                          onClick={() => navigate(`/admin/my-business`)}
                        >
                          {biz.name}
                        </span>
                        <span
                          className={createMultipleClasses([
                            styles.statusBadge,
                            biz.status === "active" ? styles.statusActive : styles.statusInactive,
                          ])}
                        >
                          {biz.status || "active"}
                        </span>
                      </div>
                      <div className={styles.nodeId}>{biz.businessCode || biz.linkedBusinessId.slice(0, 8) + '...'}</div>
                    </div>
                    <div className={styles.nodeDate}>
                      {formatDate(biz.linkedAt)}
                    </div>
                  </div>
                ))}

                {/* Empty state */}
                {filteredBusinesses.length === 0 && !rootMatchesSearch && (
                  <div className={styles.emptyState}>
                    No results match your search.
                  </div>
                )}
                {businesses.length === 0 && !searchQuery && (
                  <div className={styles.emptyState}>
                    No linked businesses yet. Use Actions → Link Business to add one.
                  </div>
                )}
              </div>
            </>
          ) : (
            /* List view — flat table */
            <table className={styles.listTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Tax</th>
                  <th>Joined Date</th>
                </tr>
              </thead>
              <tbody>
                {/* Payer row */}
                {rootMatchesSearch && (
                  <tr>
                    <td style={{ fontWeight: 600 }}>
                      {org?.name || "Organization"}
                      {" "}
                      <span className={styles.payerBadge}>payer account</span>
                    </td>
                    <td>{org?.orgCode || 'ORG-...'}</td>
                    <td>
                      <span className={createMultipleClasses([styles.statusBadge, styles.statusActive])}>
                        active
                      </span>
                    </td>
                    <td>
                      {org?.taxRate != null ? `${org.taxRate}%` : "—"}
                    </td>
                    <td>{formatDate(org?.createdAt)}</td>
                  </tr>
                )}
                {filteredBusinesses.map((biz) => (
                  <tr key={biz.linkedBusinessId}>
                    <td>
                      <span
                        style={{ cursor: 'pointer', color: '#1976D2' }}
                        onClick={() => navigate(`/admin/my-business`)}
                      >
                        {biz.name}
                      </span>
                    </td>
                    <td>{biz.businessCode || biz.linkedBusinessId.slice(0, 8) + '...'}</td>
                    <td>
                      <span
                        className={createMultipleClasses([
                          styles.statusBadge,
                          biz.status === "active" ? styles.statusActive : styles.statusInactive,
                        ])}
                      >
                        {biz.status || "active"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={createMultipleClasses([
                          styles.taxChip,
                          biz.inheritTax ? styles.taxInherited : styles.taxOverride,
                        ])}
                      >
                        {biz.inheritTax ? "Inherited" : "Override"}
                      </span>
                    </td>
                    <td>{formatDate(biz.linkedAt)}</td>
                  </tr>
                ))}
                {filteredBusinesses.length === 0 && !rootMatchesSearch && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "#71727A", padding: 32 }}>
                      No results match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>



        </div>{/* end panelsRow */}

        {/* Modals */}
        <AddMemberModal
          open={addMemberModalOpen}
          onClose={() => setAddMemberModalOpen(false)}
          orgId={id}
          onSuccess={refreshMembers}
        />
        <TaxOverrideModal
          open={taxOverrideModal.open}
          onClose={() => setTaxOverrideModal({ open: false, business: null })}
          orgId={id}
          business={taxOverrideModal.business}
          onSuccess={refreshBusinesses}
        />
        <CreateBusinessModal
          open={createBusinessModalOpen}
          onClose={() => setCreateBusinessModalOpen(false)}
          orgId={id}
          onSuccess={refreshBusinesses}
        />

        {/* Delete confirmation modal */}
        {deleteModalOpen && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }} onClick={() => setDeleteModalOpen(false)}>
            <div style={{
              background: '#fff', borderRadius: 16, padding: 32, width: 420, maxWidth: '90vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }} onClick={(e) => e.stopPropagation()}>
              <h2 style={{ fontFamily: 'Outfit', fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#D32F2F' }}>Delete Organization</h2>
              <p style={{ fontFamily: 'Outfit', fontSize: 14, color: '#555', marginBottom: 8 }}>
                Are you sure you want to delete <strong>{org?.name || 'this organization'}</strong>?
              </p>
              <p style={{ fontFamily: 'Outfit', fontSize: 13, color: '#71727A', marginBottom: 24 }}>
                This will unlink all businesses, remove all members, and cancel the subscription. This action cannot be undone.
              </p>
              {businesses.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={deleteLinkedBusinesses}
                    onChange={(e) => setDeleteLinkedBusinesses(e.target.checked)}
                    style={{ marginTop: 3, width: 16, height: 16, accentColor: '#D32F2F' }}
                  />
                  <span style={{ fontFamily: 'Outfit', fontSize: 13, color: '#555' }}>
                    Also delete all linked businesses ({businesses.length}) that are not the primary payer account
                  </span>
                </label>
              )}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: 50, border: '1px solid #E0E0E0', background: '#fff', fontFamily: 'Outfit', fontSize: 15, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteOrg}
                  disabled={isDeleting}
                  style={{ flex: 1, padding: '12px', borderRadius: 50, border: 'none', background: '#D32F2F', color: '#fff', fontFamily: 'Outfit', fontSize: 15, fontWeight: 600, cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.6 : 1 }}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationDashboard;
