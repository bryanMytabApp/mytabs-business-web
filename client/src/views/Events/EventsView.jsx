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
  Pagination,
  Chip,
  Menu,
  MenuItem,
  IconButton,
} from '@mui/material/'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import moment from 'moment'
import { useNavigate } from "react-router-dom";
import { deleteEvent, getEventsByUserId } from "../../services/eventService";
import { applySearch, getEventPicture } from "../../utils/common"
import { toast } from "react-toastify";
import { MTBMenuActions } from "../../components";

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
let userId
const EventsView = () => {
  const [selectedItems, setSelectedItems] = useState([])
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [numbersOfPage, setNumbersOfPage] = useState(0)
  const [shownItems, setShownItems] = useState([])
  const [searchTerm, setSearchTerm] = useState("")

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

  const handleChangeMainCheckbox = (value) => {
    if(value) {
      let newSelectedItems = items.map(item => item._id)
      setSelectedItems(newSelectedItems)
      return
    }
    setSelectedItems([])
  }

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl)

  const handleClick = (event, item) => {
    console.log("🚀 ~ handleClick ~ item:", item)
    setAnchorEl(event.currentTarget);
  };
  const handleClose = (e, item, type, index) => {
    console.log("🚀 ~ handleClose ~ index:", index)
    console.log("🚀 ~ handleClose ~ item:", item.name)
    if(item === "backdropClick") {
      setAnchorEl(null);
      return
    }
    // if(type === 'Delete') {
    //   deleteEvent(item)
    //     .then(res => {
    //       init()
    //       toast.success("Ad deleted!");
    //     })
    //     .catch(err => {
    //       toast.error("Cannot delete ad");
    //     })
    // }
  };

  const options = [
    'Edit',
    'Delete',
  ];

  const handleGoBack = () => navigation("/admin/home")
  
  const ITEM_HEIGHT = 48;

  const createMultipleClasses = (classes = []) => classes.join(' ');

  const parseJwt = (token) => {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );

    return JSON.parse(jsonPayload)["custom:user_id"];
  };

  useEffect(() => {
    const token = localStorage.getItem("idToken");
    userId = parseJwt(token);
    init()
  }, []);

  const init = () => {
    getEventsByUserId(userId)
      .then(res => {
        setItems(res.data)
        setNumbersOfPage(Math.ceil(res.data.length / 4))
      })
      .catch(err => console.error(err))
  }

  const editEvent = (rowId) => {
    navigation('/admin/my-events/' + rowId)
  }

  useEffect(() => {
    let itemsFiltered = JSON.parse(JSON.stringify(items))
    itemsFiltered = applySearch(searchTerm, itemsFiltered, ['name', 'description'])
    setNumbersOfPage(Math.ceil(itemsFiltered.length / 4));
    itemsFiltered = itemsFiltered.slice((page * 4) - 4, page * 4)
    setShownItems(itemsFiltered)
  }, [searchTerm, items, page]);

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
        <div className={styles.tableContainer} style={{ position: 'relative' }}>
          <div className={styles.tableActions}>
            <div className={styles.inputContainer}>
              <span class="material-symbols-outlined" className={createMultipleClasses([styles['search-icon'], 'material-symbols-outlined'])}>
                search
              </span>
              <input
                className={styles.input}
                type="text"
                value={searchTerm}
                placeholder="Search"
                onBlur={() => {}}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className={styles.buttonsContainer}>
              <button className={createMultipleClasses([styles.baseButton, styles.exportButton])}>
                <span class="material-symbols-outlined">
                  download
                </span>
                Export
              </button>
              <button
                className={createMultipleClasses([styles.baseButton, styles.createEventButton])}
                onClick={() => navigation("/admin/my-events/create")}
              >
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
                    <div className={styles.tableHeader}>Event name</div>
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
                {shownItems.map((row, index) => (
                  <TableRow
                    key={row._id}
                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    classes={{tableRow: styles.tableRow}}
                    // onClick={() => editEvent(row._id)}
                  >
                    <TableCell component="th" scope="row" >
                      <ChildCheckbox
                        checked={testChecked(row._id)}
                        onChange={e => handleChange(e, row._id)}
                        color="secondary"
                      />
                    </TableCell>
                    <TableCell component="th" scope="row" >
                      <div className={styles.advertisementImg}>
                        <img
                          src={getEventPicture(row._id)}
                          alt={row.name}
                          width="70" height="70"
                        />
                      </div>
                    </TableCell>
                    <TableCell component="th" scope="row" >
                      <span className={styles.outfitFamily}>
                        {row.name}
                      </span>
                    </TableCell>
                    <TableCell >
                      <span className={styles.outfitFamily}>
                        {moment(row.startDate).format('DD/MM/yyyy hh:mma').toString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={styles.outfitFamily}>
                        {moment(row.endDate).format('DD/MM/yyyy hh:mma').toString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={styles.outfitFamily}>
                        {row.zipCode}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={styles.outfitFamily}>
                        {moment(row.createdAt).format('DD/MM/yyyy').toString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <MTBMenuActions row={row} callback={init}/>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Pagination count={numbersOfPage} page={page} onChange={handleChangePage} />
        </div>
      </div>
    </div>
 )
};

export default EventsView;

