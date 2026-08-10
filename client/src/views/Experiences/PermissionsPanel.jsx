import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  IconButton,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import { getPermissions, updatePermissions } from "../../services/experienceService";

const ACCENT = "#F09925";

const PERMISSION_LEVELS = ["View", "Manage", "Operate", "Admin"];

const LEVEL_COLORS = {
  View: { bg: "#E3F2FD", color: "#1565C0" },
  Manage: { bg: "#E8F5E9", color: "#2E7D32" },
  Operate: { bg: "#FFF3E0", color: "#E65100" },
  Admin: { bg: "#F3E5F5", color: "#7B1FA2" },
};

/**
 * PermissionsPanel — Admin-only view for managing user permission levels on
 * experience instances.
 *
 * Displays a table of users with assigned permission levels.
 * Supports assigning, updating, and revoking permissions.
 *
 * Requirements: 8.1, 8.4, 8.6
 */
const PermissionsPanel = () => {
  const { eventId, experienceId } = useParams();

  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Add user dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserLevel, setNewUserLevel] = useState("View");
  const [addError, setAddError] = useState(null);
  const [adding, setAdding] = useState(false);

  // Revoke confirmation dialog
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);

  // Inline level update
  const [updatingUserId, setUpdatingUserId] = useState(null);

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPermissions(eventId, experienceId);
      const data = res.data?.data?.permissions || res.data?.permissions || [];
      setPermissions(data);
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Failed to load permissions";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [eventId, experienceId]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) {
      setAddError("Email is required");
      return;
    }

    setAdding(true);
    setAddError(null);
    try {
      await updatePermissions(eventId, experienceId, {
        email: newUserEmail.trim(),
        level: newUserLevel,
        action: "assign",
      });
      setAddDialogOpen(false);
      setNewUserEmail("");
      setNewUserLevel("View");
      setSuccess("Permission assigned successfully.");
      fetchPermissions();
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Failed to assign permission";
      setAddError(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateLevel = async (userId, newLevel) => {
    setUpdatingUserId(userId);
    setError(null);
    try {
      await updatePermissions(eventId, experienceId, {
        userId,
        level: newLevel,
        action: "assign",
      });
      setSuccess("Permission level updated.");
      fetchPermissions();
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Failed to update permission";
      setError(msg);
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleOpenRevoke = (user) => {
    setRevokeTarget(user);
    setRevokeDialogOpen(true);
  };

  const handleRevokePermission = async () => {
    if (!revokeTarget) return;

    setRevoking(true);
    setError(null);
    try {
      await updatePermissions(eventId, experienceId, {
        userId: revokeTarget.userId,
        action: "revoke",
      });
      setRevokeDialogOpen(false);
      setRevokeTarget(null);
      setSuccess("Permission revoked successfully.");
      fetchPermissions();
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Failed to revoke permission";
      setError(msg);
    } finally {
      setRevoking(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1000, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography
            variant="h5"
            sx={{ fontWeight: 800, color: "#1D1B20", fontSize: { xs: "1.25rem", md: "1.5rem" } }}
          >
            <AdminPanelSettingsIcon
              sx={{ verticalAlign: "middle", mr: 1, color: ACCENT, fontSize: 28 }}
            />
            Permissions
          </Typography>
          <Typography sx={{ color: "#71727A", fontSize: 14, mt: 0.5 }}>
            Manage user access levels for this experience. Only Admin users can modify permissions.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<PersonAddIcon />}
          onClick={() => setAddDialogOpen(true)}
          sx={{
            background: ACCENT,
            textTransform: "none",
            fontWeight: 700,
            borderRadius: 2,
            "&:hover": { background: "#D4820F" },
          }}
        >
          Add User
        </Button>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Permissions Table */}
      {permissions.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 5,
            textAlign: "center",
            borderRadius: 3,
            border: "1.5px dashed #E0E0E0",
            background: "#FAFAFA",
          }}
        >
          <AdminPanelSettingsIcon sx={{ fontSize: 40, color: "#BDBDBD", mb: 1 }} />
          <Typography sx={{ color: "#71727A", fontWeight: 600, fontSize: 14 }}>
            No permissions assigned yet
          </Typography>
          <Typography sx={{ color: "#9E9E9E", fontSize: 13, mt: 0.5 }}>
            Add users and assign permission levels to get started.
          </Typography>
        </Paper>
      ) : (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{ borderRadius: 3, border: "1px solid #E8E8E8" }}
        >
          <Table size="small">
            <TableHead>
              <TableRow sx={{ background: "#FAFAFA" }}>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                  User
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                  Email
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                  Permission Level
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                  Source
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {permissions.map((perm) => {
                const levelStyle = LEVEL_COLORS[perm.level] || LEVEL_COLORS.View;
                const isInherited = perm.source === "inherited";

                return (
                  <TableRow
                    key={perm.userId}
                    sx={{ "&:hover": { background: "#FAFAFA" } }}
                  >
                    <TableCell sx={{ fontSize: 13, fontWeight: 500 }}>
                      {perm.displayName || perm.userId?.slice(0, 8) || "—"}
                    </TableCell>
                    <TableCell sx={{ fontSize: 13, color: "#616161" }}>
                      {perm.email || "—"}
                    </TableCell>
                    <TableCell>
                      {isInherited ? (
                        <Chip
                          size="small"
                          label={perm.level}
                          sx={{
                            fontWeight: 600,
                            fontSize: 11,
                            background: levelStyle.bg,
                            color: levelStyle.color,
                          }}
                        />
                      ) : (
                        <TextField
                          select
                          size="small"
                          value={perm.level}
                          onChange={(e) => handleUpdateLevel(perm.userId, e.target.value)}
                          disabled={updatingUserId === perm.userId}
                          sx={{
                            minWidth: 120,
                            "& .MuiSelect-select": { fontSize: 13, fontWeight: 600, py: 0.75 },
                          }}
                        >
                          {PERMISSION_LEVELS.map((level) => (
                            <MenuItem key={level} value={level} sx={{ fontSize: 13 }}>
                              {level}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={isInherited ? "Inherited" : "Assigned"}
                        variant="outlined"
                        sx={{ fontSize: 11, fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {!isInherited && (
                        <IconButton
                          size="small"
                          onClick={() => handleOpenRevoke(perm)}
                          disabled={updatingUserId === perm.userId}
                          title="Revoke permission"
                          sx={{
                            color: "#E53935",
                            "&:hover": { background: "#FFEBEE" },
                          }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add User Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: 18 }}>
          Assign Permission
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: "#71727A", mb: 2 }}>
            Enter the user's email and select a permission level to assign.
          </Typography>
          <TextField
            label="User Email"
            type="email"
            fullWidth
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            error={!!addError}
            sx={{ mb: 2 }}
          />
          <TextField
            select
            label="Permission Level"
            value={newUserLevel}
            onChange={(e) => setNewUserLevel(e.target.value)}
            fullWidth
          >
            {PERMISSION_LEVELS.map((level) => (
              <MenuItem key={level} value={level}>
                {level}
              </MenuItem>
            ))}
          </TextField>
          {addError && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
              {addError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => {
              setAddDialogOpen(false);
              setAddError(null);
              setNewUserEmail("");
              setNewUserLevel("View");
            }}
            sx={{ textTransform: "none", color: "#71727A", fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddUser}
            disabled={adding || !newUserEmail.trim()}
            sx={{
              background: ACCENT,
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 2,
              "&:hover": { background: "#D4820F" },
            }}
          >
            {adding ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Assign"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <Dialog
        open={revokeDialogOpen}
        onClose={() => setRevokeDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: 18 }}>
          Revoke Permission?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: "#424242" }}>
            Are you sure you want to revoke access for{" "}
            <strong>{revokeTarget?.displayName || revokeTarget?.email || "this user"}</strong>?
            They will no longer have access to this experience.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => {
              setRevokeDialogOpen(false);
              setRevokeTarget(null);
            }}
            sx={{ textTransform: "none", color: "#71727A", fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRevokePermission}
            disabled={revoking}
            sx={{
              background: "#E53935",
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 2,
              "&:hover": { background: "#C62828" },
            }}
          >
            {revoking ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Revoke"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PermissionsPanel;
