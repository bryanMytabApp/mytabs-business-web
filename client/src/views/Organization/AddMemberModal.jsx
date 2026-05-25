import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { addMember } from "../../services/organizationService";
import { toast } from "react-toastify";

const AddMemberModal = ({ open, onClose, orgId, onSuccess }) => {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("member");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!userId.trim()) {
      toast.error("Please enter a user ID or email");
      return;
    }
    try {
      setIsSubmitting(true);
      await addMember(orgId, userId.trim(), role);
      toast.success("Member added successfully");
      setUserId("");
      setRole("member");
      onClose();
      onSuccess();
    } catch (err) {
      toast.error("Failed to add member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setUserId("");
    setRole("member");
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontFamily: "Outfit", fontWeight: 600 }}>
        Add Member
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="User ID or Email"
          fullWidth
          variant="outlined"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="Enter user ID or email"
          sx={{ mt: 1, "& .MuiInputBase-root": { fontFamily: "Outfit" } }}
        />
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel sx={{ fontFamily: "Outfit" }}>Role</InputLabel>
          <Select
            value={role}
            label="Role"
            onChange={(e) => setRole(e.target.value)}
            sx={{ fontFamily: "Outfit" }}
          >
            <MenuItem value="admin" sx={{ fontFamily: "Outfit" }}>Admin</MenuItem>
            <MenuItem value="member" sx={{ fontFamily: "Outfit" }}>Member</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} sx={{ fontFamily: "Outfit", color: "#71727A" }}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isSubmitting}
          variant="contained"
          sx={{ fontFamily: "Outfit", backgroundColor: "#F09925", "&:hover": { backgroundColor: "#d9871e" } }}
        >
          {isSubmitting ? "Adding..." : "Add Member"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddMemberModal;
