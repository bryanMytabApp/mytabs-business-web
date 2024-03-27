import React, { useEffect, useState } from "react";
import styles from './EventsView.module.css'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  TablePagination,
  Chip,
  Menu,
  MenuItem,
  IconButton,
  Button
} from '@mui/material/'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import moment from 'moment'
import { useNavigate } from "react-router-dom";

function createData(
  name,
  date,
  startDate,
  endDate,
  zipCode,
  createdAt,
) {
  return { name, date, startDate, endDate, zipCode, createdAt, id: (Math.random() * 100).toString() };
}

const items = [
  createData('Event 1', moment().toString(), moment().toString(), moment().toString(), '12345', moment().toString()),
  createData('Event with long name', moment().toString(), moment().toString(), moment().toString(), '12345', moment().toString()),
  createData('Event with longger name', moment().toString(), moment().toString(), moment().toString(), '12345', moment().toString()),
  createData('Event with longger name', moment().toString(), moment().toString(), moment().toString(), '12345', moment().toString()),
  // createData('Event 1', moment().toString(), moment().toString(), moment().toString(), '12345', moment().toString()),
  // createData('Event with long name', moment().toString(), moment().toString(), moment().toString(), '12345', moment().toString()),
  // createData('Event with longger name', moment().toString(), moment().toString(), moment().toString(), '12345', moment().toString()),
  // createData('Event with longger name', moment().toString(), moment().toString(), moment().toString(), '12345', moment().toString()),
];

const ChildCheckbox = ({ checked, onChange }) => {
  const label = { inputProps: { 'aria-label': 'Checkbox demo' } }
  return (
    <Checkbox
      {...label}
      checked={checked}
      onChange={e => onChange(e)}
    />
  )
}

const EventsView = () => {
  const [selectedItems, setSelectedItems] = useState([])
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(items.length)
  const navigation = useNavigate();
  const handleChange = (event, id) => {
    if(event.target.checked) {
      setSelectedItems([
        ...selectedItems,
        id,
      ])
      return
    }
    let indexOfElement = selectedItems.indexOf(id)
    if(indexOfElement === -1) {
      return
    }
    let selectedItemsCopy = JSON.parse(JSON.stringify(selectedItems))
    selectedItemsCopy.splice(indexOfElement, 1)
    setSelectedItems(selectedItemsCopy)
  }

  const testChecked = (id) => {
    return selectedItems.some(i => i === id)
  }

  const testCheckedMain = () => {
    return items.length === selectedItems.length
  }

  const handleChangePage = (event, newPage) => {
    setPage(newPage)
  }
  const handleDelete = (event, newPage) => {
    setPage(newPage)
  }
  // const handleClick = (event, newPage) => {
  //   setPage(newPage)
  // }

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }

  const handleChangeMainCheckbox = (value) => {
    if(value) {
      let newSelectedItems = items.map(item => item.id)
      setSelectedItems(newSelectedItems)
      return
    }
    setSelectedItems([])
  }

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [anchorEl1, setAnchorEl1] = useState(null);
  const open1 = Boolean(anchorEl1);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleClick1 = (event) => {
    setAnchorEl1(event.currentTarget);
  };
  const handleClose1 = () => {
    setAnchorEl1(null);
  };
  const handleCloseTest = (e, a) => {
    console.log(e.target.value)
    setAnchorEl1(null);
  };
  const options = [
    'Edit',
    'Delete',
  ];

  const options1 = [
    '5',
    '10',
  ];

  const handleGoBack = () => navigation("/admin/home")
  
  const ITEM_HEIGHT = 48;

  const createMultipleClasses = (classes = []) => classes.join(' ');

 return (
    <div className={styles.view}>
      <div className={styles.contentContainer}>
        <div className={styles.titleContainer}>
          <IconButton aria-label="delete" onClick={handleGoBack}>
            <ArrowBackIcon />
          </IconButton>
          <h1>
            My Ads
          </h1>
        </div>
        <div className={styles.tableContainer}>
          <div className={styles.tableActions}>
            <div className={styles.inputContainer}>
              <span class="material-symbols-outlined" className={createMultipleClasses([styles['search-icon'], 'material-symbols-outlined'])}>
                search
              </span>
              <input
                className={styles.input}
                type="text"
                value={''}
                placeholder="Search now"
                onBlur={() => {}}
                onChange={(e) => (e.target.value)}
              />
            </div>
            <div className={styles.buttonsContainer}>
              <button className={createMultipleClasses([styles.baseButton, styles.exportButton])}>
                <span class="material-symbols-outlined">
                  download
                </span>
                Export
              </button>
              <button className={createMultipleClasses([styles.baseButton, styles.createEventButton])}>
                <span class="material-symbols-outlined">
                  add
                </span>
                Create Ad
              </button>
            </div>
          </div>
          <TableContainer component={Paper} className={styles.innertableContainer}>
            <Table  >
              <TableHead>
                <TableRow>
                  <TableCell>
                    <ChildCheckbox
                      sx={{
                        width: 300,
                        background: 'white',
                      }}
                      checked={testCheckedMain()}
                      onChange={e => handleChangeMainCheckbox(e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className={styles.tableHeader}>Advertisement</div>
                  </TableCell>
                  <TableCell>
                    <div className={styles.tableHeader}>Name</div>
                  </TableCell>
                  <TableCell>
                    <div className={styles.tableHeader}>Date</div>
                  </TableCell>
                  <TableCell>
                    <div className={styles.tableHeader}>Start time</div>
                  </TableCell>
                  <TableCell>
                    <div className={styles.tableHeader}>End time</div>
                  </TableCell>
                  <TableCell>
                    <div className={styles.tableHeader}>Zip code</div>
                  </TableCell>
                  <TableCell>
                    <div className={styles.tableHeader}>Creation date</div>
                  </TableCell>
                  <TableCell>
                    <div className={styles.tableHeader}>Actions</div>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody >
                {items.map((row) => (
                  <TableRow
                    key={row.name}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    classes={{tableRow: styles.tableRow}}
                  >
                    <TableCell component="th" scope="row" >
                      <ChildCheckbox
                        checked={testChecked(row.id)}
                        onChange={e => handleChange(e, row.id)}
                        color="secondary"
                      />
                    </TableCell>
                    <TableCell component="th" scope="row" >
                      <div className={styles.advertisementImg}>
                        <img
                          src="https://s3-alpha-sig.figma.com/img/e805/dd2c/a6e72d26c01948e9692de91ca803243b?Expires=1712534400&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4&Signature=SvFgtYtj8ELTLlZqbU5vbARpxtalXSwWtdnDaRwnyB4jqBKUk4p5r4r0TI3ZyM6-QawrGk5L~BUAWTcIYiYrTjHpOkcdPWP90YLGvdC3ZSYJutmD47cBu8YlxieELzQvoaeE5J382IgJo4VO6hcn~RJ2Q2iKGiHFOJ~jVLcvPAVTVTuDq-5ohep22xy4KlopBc71LH1T98LW3PBpNlO2WEjLKQxDqZQUmUG09R5LI038iPLFkfjFtTtAxH21U1RU1V3DHwfO6IJsIK15kfvL~-9gS7uX1PGMwdGufD6GrVaVGvn7J5DN4k-6bac9is4J2FBSretUqRyoas80l3iizQ__"
                          alt={row.name}
                          width="70" height="70"
                        />
                      </div>
                    </TableCell>
                    <TableCell component="th" scope="row" >
                      {row.name}
                    </TableCell>
                    <TableCell >{moment(row.date).format('DD/MM/yyyy').toString()}</TableCell>
                    <TableCell >{moment(row.startDate).format('DD/MM/yyyy').toString()}</TableCell>
                    <TableCell >{moment(row.endDate).format('DD/MM/yyyy').toString()}</TableCell>
                    <TableCell >{row.zipCode}</TableCell>
                    <TableCell >{moment(row.createdAt).format('DD/MM/yyyy').toString()}</TableCell>
                    <TableCell >
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
                        onClick={handleClick}
                        deleteIcon={<KeyboardArrowDownIcon />}
                        onDelete={handleClick}
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
                          <MenuItem key={option} selected={option === 'Pyxis'} onClick={handleClose}>
                            {option}
                          </MenuItem>
                        ))}
                      </Menu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <div>
            <IconButton aria-label="delete">
              <KeyboardArrowLeftIcon />
            </IconButton>
            <input type="text" value={1} accept="number" className={styles.paginatorContainer} />
            <IconButton aria-label="delete">
              <KeyboardArrowRightIcon />
            </IconButton>
            <Button
              id="demo-customized-button"
              variant="contained"
              disableElevation
              sx={{
                backgroundColor: '#FCFCFC',
                color: '#676565',
                border: 'none',
                textTransform: 'none',
                borderRadius: '10px'
              }}
              disableFocusRipple={true}
              onClick={handleClick1}
              size="small"
              endIcon={<KeyboardArrowDownIcon />}
            >
              4/length
            </Button>
            <Menu
              id="long-menu1"
              MenuListProps={{
                'aria-labelledby': 'long-button',
              }}
              anchorEl={anchorEl1}
              open={open1}
              onClose={handleClose1}
              PaperProps={{
                style: {
                  maxHeight: ITEM_HEIGHT * 4.5,
                  width: '20ch',
                },
              }}
            >
              {options1.map((option) => (
                <MenuItem key={option} selected={option === 'Pyxis'} onClick={handleCloseTest}>
                  {option}
                </MenuItem>
              ))}
            </Menu>
          </div>
        </div>
      </div>
    </div>
 )
};

export default EventsView;

