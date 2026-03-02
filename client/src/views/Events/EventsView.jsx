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
import { MTBLoading, MTBMenuActions } from "../../components";
import { getCustomerSubscription, getSystemSubscriptions } from "../../services/paymentService";

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

let currentSubscription;

const EventsView = () => {
  const [selectedItems, setSelectedItems] = useState([])
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [numbersOfPage, setNumbersOfPage] = useState(0)
  const [shownItems, setShownItems] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
const [systemSubscriptions, setSystemSubscriptions] = useState([]);
 const [currentLevel, setCurrentLevel] = useState(0);
 const [activeLength, setActiveLength] = useState(3);
 const [isLoading, setIsLoading] = useState(false);
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
 const getCustomerSubscriptionWrapper = async ({userId, subscriptionList}) => {
    try {
      let res = await getCustomerSubscription({userId});
      
      // Check if we got a valid response
      if (!res || !res.data) {
        console.warn("Invalid response from getCustomerSubscription - using default Basic plan");
        setIsLoading(false);
        // Set default values
        setActiveLength(3);
        setCurrentLevel(1);
        await init(3); // Default to basic level items
        return null;
      }

      currentSubscription = res.data;

      // Check if user has no subscription - use default Basic plan
      if (!res.data.hasSubscription || !res.data.priceId) {
        console.log("User has no subscription - using default Basic plan (3 ad spaces)");
        setActiveLength(3);
        setCurrentLevel(1); // Set to level 1 (Basic) instead of 0
        await init(3); // Default to basic level items
        return res;
      }

      // Find subscription item and handle possible undefined case
      let subItem = subscriptionList.find((el) => el.priceId === res.data.priceId);
      
      if (!subItem) {
        console.warn("Could not find matching subscription item - using default Basic plan");
        setActiveLength(3);
        setCurrentLevel(1); // Set to level 1 (Basic) instead of 0
        await init(3); // Default to basic level items
        return res;
      }
      
      let len;
      if (subItem.level === 3) {
        len = 25;
        setActiveLength(25);
      }
      if (subItem.level === 2) {
        len = 10;
        setActiveLength(10);
      }
      if (subItem.level === 1) {
        len = 3;
        setActiveLength(3);
      }
      setCurrentLevel(subItem.level);
      await init(len);
      return res;
    } catch (error) {
      console.warn("Error loading subscription - using default Basic plan:", error);
      setIsLoading(false);
      setActiveLength(3);
      setCurrentLevel(1);
      await init(3); // Default to basic level items
      return null;
    }
  };
  useEffect(() => {
    const token = localStorage.getItem("idToken");
    userId = parseJwt(token);
    setIsLoading(true);

    const fetchSystemSubscriptions = async () => {
      try {
        const response = await getSystemSubscriptions();
        if (response?.data) {
          setSystemSubscriptions(response.data);
          try {
            await getCustomerSubscriptionWrapper({userId, subscriptionList: response.data});
          } catch (subscriptionError) {
            console.error("Error in customer subscription wrapper:", subscriptionError);
            toast.error("Failed to load subscription details");
            setActiveLength(3);
            setCurrentLevel(0);
            await init(3); // Default to basic level items
          } finally {
            setIsLoading(false);
          }
        } else {
          console.error("No data received from getSystemSubscriptions");
          toast.error("Unable to retrieve subscription information");
          setActiveLength(3);
          setCurrentLevel(0);
          await init(3); // Default to basic level items
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to fetch system subscriptions:", error);
        toast.error("Failed to load subscription data");
        setActiveLength(3);
        setCurrentLevel(0);
        await init(3); // Default to basic level items
        setIsLoading(false);
      }
    };
    fetchSystemSubscriptions();
  // getCustomerSubscriptionWrapper is defined inside the component, 
  // but it doesn't change between renders, so we can safely ignore it
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [] );
  const handleCreateAd = () => {
    if ( currentLevel === 1 && items.length < 3 ) {
      navigation("/admin/my-events/create");
  
    } else if(currentLevel === 1 && items.length >= 3) {
      toast.warn("You can only upload up to 3 ads in Basic subscription. Upgrade to create more!");
    }else if (currentLevel === 2 && items.length < 10) {
      navigation("/admin/my-events/create");
    } else if(currentLevel === 2 && items.length >= 10){
      toast.warn("You can only upload up to 10 ads in Plus subscription. Upgrade to Premium for more!");
    } else if(currentLevel === 3 && items.length < 25) {
      navigation("/admin/my-events/create");  
    } else if(currentLevel === 3 && items.length >= 25){
      toast.warn("You have reached the maximum of 25 ads in Premium subscription.");  
    }
    };
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
    // if(type === 'Delete') {
    //   deleteEvent(item)
    //     .then(res => {
    //       init()
    //       toast.success("Ad deleted!");
    //     })
    //     .catch(err => {
    //       toast.efrror("Cannot delete ad");
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
    if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
      console.warn('Invalid or missing JWT token in EventsView');
      return null;
    }
    
    try {
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
    } catch (error) {
      console.error('Error parsing JWT token:', error);
      return null;
    }
  };

 

  const init = async ( len ) => {
    getEventsByUserId(userId)
      .then( res => {
        setItems(res.data.slice(0,len))
        setNumbersOfPage(Math.ceil(res.data.slice(0,len).length / 4))
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
  if ( isLoading ) {
    return <div className={styles.view}>
      <MTBLoading />
    </div>;
  }
 return (
    <div className={styles.view}>
      <div className={styles.contentContainer}>
        <div className={styles.titleContainer}>
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
                onClick={handleCreateAd}
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
                    <div className={styles.tableHeader}>Event Name</div>
                  </TableCell>
                  <TableCell>
                    <div className={styles.tableHeader}>Start Time</div>
                  </TableCell>
                  <TableCell>
                    <div className={styles.tableHeader}>End Time</div>
                  </TableCell>
                  <TableCell>
                    <div className={styles.tableHeader}>Zip Code</div>
                  </TableCell>
                  <TableCell>
                    <div className={styles.tableHeader}>Creation Date</div>
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
                        {row.startDate ? moment(row.startDate).format('MM/DD/YYYY hh:mma') : 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={styles.outfitFamily}>
                        {row.endDate ? moment(row.endDate).format('MM/DD/YYYY hh:mma') : 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={styles.outfitFamily}>
                        {row.zipCode}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={styles.outfitFamily}>
                        {row.createdAt ? moment(row.createdAt).format('MM/DD/YYYY') : 'N/A'}
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
