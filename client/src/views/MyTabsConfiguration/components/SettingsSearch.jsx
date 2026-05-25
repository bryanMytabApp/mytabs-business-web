import React, { useState, useEffect, useRef } from 'react';
import { TextField, InputAdornment, Typography, Box } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useSettings } from '../context/SettingsContext';

const styles = {
  container: {
    padding: '16px 16px 8px',
  },
  textField: {
    '& .MuiOutlinedInput-root': {
      fontSize: '13px',
      borderRadius: '8px',
      backgroundColor: '#FFFFFF',
      '& fieldset': {
        borderColor: '#E5E7EB',
      },
      '&:hover fieldset': {
        borderColor: '#D1D5DB',
      },
      '&.Mui-focused fieldset': {
        borderColor: '#4F46E5',
      },
    },
    '& .MuiInputBase-input': {
      padding: '8px 12px',
    },
  },
  searchIcon: {
    color: '#9CA3AF',
    fontSize: '18px',
  },
  noResults: {
    padding: '12px 16px',
    fontSize: '13px',
    color: '#9CA3AF',
    textAlign: 'center',
  },
};

const SettingsSearch = ({ sections, onFilterChange }) => {
  const [query, setQuery] = useState('');
  const { dispatch } = useSettings();
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      dispatch({ type: 'SET_SEARCH_QUERY', payload: query });

      if (onFilterChange) {
        if (!query.trim()) {
          onFilterChange(null);
        } else {
          const filtered = sections.filter((section) =>
            section.label.toLowerCase().includes(query.toLowerCase())
          );
          onFilterChange(filtered);
        }
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, sections]);

  return (
    <Box sx={styles.container} data-testid="settings-search">
      {/* Hidden dummy fields to absorb browser autofill */}
      <input type="text" name="prevent-autofill-user" style={{ display: 'none' }} tabIndex={-1} />
      <input type="password" name="prevent-autofill-pass" style={{ display: 'none' }} tabIndex={-1} />
      <TextField
        fullWidth
        size="small"
        type="search"
        placeholder="Search settings..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={styles.textField}
        autoComplete="off"
        name="settings-search-filter"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={styles.searchIcon} />
            </InputAdornment>
          ),
        }}
        inputProps={{ 'aria-label': 'Search settings', autoComplete: 'off', 'data-form-type': 'other', role: 'searchbox' }}
      />
    </Box>
  );
};

export const NoResultsMessage = () => (
  <Typography sx={styles.noResults} data-testid="no-results">
    No results found
  </Typography>
);

export default SettingsSearch;
