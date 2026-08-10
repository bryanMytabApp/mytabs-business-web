import React, { useState, useCallback } from "react";
import { Box, TextField, InputAdornment, IconButton, CircularProgress } from "@mui/material";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import ClearIcon from "@mui/icons-material/Clear";

const ACCENT = "#F09925";

/**
 * EntrySearchBar — Search bar for finding entries by attendee name or entry code.
 * Calls onSearch with the search term after a short debounce.
 *
 * @param {object} props
 * @param {function} props.onSearch - Callback with search string
 * @param {boolean} [props.loading] - Whether a search is in progress
 * @param {string} [props.placeholder] - Placeholder text
 */
const EntrySearchBar = ({
  onSearch,
  loading = false,
  placeholder = "Search by name or entry code...",
}) => {
  const [value, setValue] = useState("");
  const debounceRef = React.useRef(null);

  const handleChange = useCallback(
    (e) => {
      const newValue = e.target.value;
      setValue(newValue);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        if (newValue.trim().length >= 2 || newValue.trim().length === 0) {
          onSearch(newValue.trim());
        }
      }, 400);
    },
    [onSearch]
  );

  const handleClear = () => {
    setValue("");
    onSearch("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onSearch(value.trim());
    }
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 400 }}>
      <TextField
        fullWidth
        size="small"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchOutlinedIcon sx={{ color: "#9E9E9E", fontSize: 20 }} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              {loading ? (
                <CircularProgress size={18} sx={{ color: ACCENT }} />
              ) : value ? (
                <IconButton size="small" onClick={handleClear} sx={{ p: 0.5 }}>
                  <ClearIcon sx={{ fontSize: 18, color: "#9E9E9E" }} />
                </IconButton>
              ) : null}
            </InputAdornment>
          ),
          sx: {
            borderRadius: 2,
            fontSize: 14,
            "& fieldset": { borderColor: "#E8E8E8" },
            "&:hover fieldset": { borderColor: ACCENT },
            "&.Mui-focused fieldset": { borderColor: ACCENT },
          },
        }}
      />
    </Box>
  );
};

export default EntrySearchBar;
