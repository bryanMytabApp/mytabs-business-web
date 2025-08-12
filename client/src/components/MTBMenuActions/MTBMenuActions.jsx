import React, { useState } from "react";
import {
  Chip,
  Menu,
  MenuItem,
} from '@mui/material/'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useNavigate } from "react-router-dom";
import { deleteEvent } from "../../services/eventService";
import { toast } from "react-toastify";

const MTBMenuActions = ({ row, callback}) => {
  const navigation = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl)

  const handleClick = (event, item) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (e, item, type, index) => {
    if(item === "backdropClick") {
      setAnchorEl(null);
      return
    }
    if(type === 'Delete') {
      deleteEvent(item)
        .then(res => {
          callback()
          toast.success("Ad deleted!");
        })
        .catch(err => {
          toast.error("Cannot delete ad");
        })
    }
    else if(type === 'Edit') {
      editEvent(item._id)
    }
  };

  const options = [
    'Edit',
    'Delete',
  ];

  const handleGoBack = () => navigation("/admin/home")
  
  const ITEM_HEIGHT = 48;


  const editEvent = (rowId) => {
    navigation('/admin/my-events/' + rowId)
  }

 return (
    <div>
      <Chip
        label="Actions"
        aria-label="more"
        id="long-button"
        variant="outlined"
        sx={{
          backgroundColor: '#FCFCFC',
          color: '#676565',
          border: '1px solid #D3D3D3'
        }}
        onClick={(e) => handleClick(e, row)}
        deleteIcon={<KeyboardArrowDownIcon />}
        onDelete={(e) => handleClick(e, row)}
      />
      <Menu
        id="long-menu"
        MenuListProps={{
          'aria-labelledby': 'long-button',
        }}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          style: {
            maxHeight: ITEM_HEIGHT * 4.5,
            width: '20ch',
          },
        }}
      >
        {options.map((option) => (
          <MenuItem
            key={option + row._id}
            selected={option === 'Pyxis'}
            onClick={(e) => handleClose(e, row, option)}
          >
            {option}
          </MenuItem>
        ))}
      </Menu>
    </div>
 )
};

export default MTBMenuActions;

