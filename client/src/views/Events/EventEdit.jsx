import React, { useEffect, useRef, useState } from "react";
import styles from './EventEdit.module.css'
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
import { useNavigate, useParams } from "react-router-dom";
import { deleteEvent, getEvent, getEventsByUserId, getPresignedUrlForEvent, updateEvent } from "../../services/eventService";
import { applySearch, getEventPicture } from "../../utils/common"
import { toast } from "react-toastify";
import { State, City } from 'country-state-city';
import { MTBSelector, MTBTicketsEditor } from "../../components";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { processImage } from "../../components/MTBDropZone/MTBDropZone";
import axios from "axios";

const countryCode = 'US';
let userId

const EventEdit = () => {
  const [selectedItems, setSelectedItems] = useState([])
  const [states, setStates] = useState([])
  const [item, setItem] = useState({})
  const [tickets, setTickets] = useState([])
  const [cities, setCities] = useState([])
  const [editScreen, setEditScreen] = useState(0)
  const [uploadedImage, setUploadedImage] = useState(null)
  
  const routeProps = useParams()

  const navigation = useNavigate();

  const handleGoBack = () => navigation("/admin/my-events")

  const createMultipleClasses = (classes = []) => classes.filter(cl => cl).join(' ');

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

  const init = () => {
    let { eventId } = routeProps
    if(!eventId || !userId) {
      return
    }
    getEvent(userId, eventId)
      .then(res => {
        let item = res.data
        item.startDate = moment(item.startDate)
        item.endDate = moment(item.endDate)
        setItem(item)
        setTickets(item.tickets)
      })
      .catch(err => console.error(err))
  }

  useEffect(() => {
    const token = localStorage.getItem("idToken");
    userId = parseJwt(token);
    init()
    let availableStates = State.getStatesOfCountry(countryCode);
    setStates(availableStates)
  }, []);

  useEffect(() => {
    if(!item.state) {
      return
    }
    let selectedState = states.find(state => state.name === item.state)
    let availableCities = City.getCitiesOfState(countryCode, selectedState.isoCode)
    setCities(availableCities)
  }, [item.state])

  const changeEditScreen = (next) => {
    if(next === 0 && !ticketsValidated()) {
      toast.error('Please fill the tickets with errors')
      return
    }
    setEditScreen(next)
  }

  const validateTicket = (ticket = {}, index) => {
    let error = false
    if(ticket.option === 'External link') {
      if((!ticket.link1 && !ticket.link2 && !ticket.link3) || !ticket.type) {
        error = true
      }
    } else {
      if(!ticket.type) {
        error = true
      }
    }
    return {
      ...ticket,
      error
    }
  }

  const ticketsValidated = () => {
    let ticketsCopy = JSON.parse(JSON.stringify(tickets))
    ticketsCopy = ticketsCopy.map(ticket => validateTicket(ticket))
    setTickets(ticketsCopy)
    if(ticketsCopy.some(t => t.error)) {
      return false
    }
    return true
  }
  
  const handleItemChange = (attr, value) => {
    if(attr === 'description' && value.length >= 140) {
      return
    }
    if(attr === 'zipCode' && (value.length > 5 || isNaN(value)) ) {
      return
    }
    if(attr === 'state') {
      setItem(prev => ({
        ...prev,
        [attr]: value,
        city: '',
      }))
      return
    }
    setItem(prev => ({
      ...prev,
      [attr]: value
    }))
  }

  const inputref = useRef(null);

  const uploadFile = () => {
    if (inputref.current) {
      inputref.current.click()
    }
  }

  const processFile = async (e) => {
    let file = e.target.files[0]
    
    const processedImageUrl = await processImage(URL.createObjectURL(file), 30)

    setUploadedImage(processedImageUrl);
  }

  const _updateEvent = async () => {
    if(!ticketsValidated()) {
      toast.error('Please fill the tickets with errors')
      return
    }
    let itemCopy = Object.assign({}, item)
    itemCopy.startDate = moment(itemCopy.startDate).toString()
    itemCopy.endDate = moment(itemCopy.endDate).toString()
    itemCopy.tickets = tickets
    if(itemCopy.startDate !== item.startDate || itemCopy.endDate !== item.endDate) {
      itemCopy.timeChanged = true
    }else{
      itemCopy.timeChanged = false
    }

    let data
    try {
      let res = await updateEvent(itemCopy)
      data = res.data
      toast.success("Saved changes!");
    } catch (error) {
      toast.error("Cannot save changes");
      console.error(error);
      return
    }
    if(uploadedImage) {
      let presignedUrl
      try {
        let res = await getPresignedUrlForEvent({
          id: data._id,
          userId
        })
        presignedUrl = res.data
      } catch (error) {
        toast.error("cannot create presigned url");
        console.error(error);
        return
      }
  
      const base64Response = await fetch(uploadedImage);
      const blob = await base64Response.blob();
      try {
        await axios.put(presignedUrl, blob)
        toast.success("Image was successfully uploaded");
      } catch (error) {
        toast.error("Cannot upload image");
      }
    }
    handleGoBack()
  }


  
 return (
    <div className={styles.view}>
      <div className={styles.contentContainer}>
      <input
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => processFile(e)}
        ref={inputref}
      />
        <div className={styles.titleContainer}>
          <IconButton aria-label="delete" onClick={handleGoBack}>
            <ArrowBackIcon />
          </IconButton>
          <h1>
            My Ads
          </h1>
        </div>
        <div className={styles.tableContainer}>
          <div className={styles.buttonsContainer}>
            <button
              className={
                createMultipleClasses([
                  styles.contentSelector,
                  styles['outfit-font'],
                  editScreen == 0 ? styles['primary-background'] : styles['white-background'],
                  editScreen == 0 ? styles['white-color'] : styles['secundary-color'],
                ])}
              onClick={() => changeEditScreen(0)}
            >
              General Details
            </button>
            <button
              className={
                createMultipleClasses([
                  styles.contentSelector,
                  styles['outfit-font'],
                  editScreen == 1 ? styles['primary-background'] : styles['white-background'],
                  editScreen == 1 ? styles['white-color'] : styles['secundary-color'],
                ])}
              onClick={() => changeEditScreen(1)}
            >
              Tickets
            </button>
          </div>
          {editScreen === 1 ?
            <MTBTicketsEditor
              tickets={tickets}
              setTickets={setTickets}
            /> :
            <div style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                height: '90%',
              }}
            >
              <div
                className={createMultipleClasses([styles.contentDivider, styles.leftMainContainer])}
                style={{
                  width: '44%',
                  position: 'relative'
                }}
              >
                <div className={styles.advertisementImg} >
                  <img
                    src={uploadedImage ? uploadedImage : getEventPicture(item._id)}
                    alt={item.name}
                    style={{ borderRadius: '10px' }}
                    width="420" height="420"
                  ></img>
                  <button
                    className={createMultipleClasses([
                      styles.baseButton,
                      styles.buttonAbsolute,
                      styles['primary-background']
                    ])}
                    onClick={uploadFile}
                  >
                    Submit
                    <span class="material-symbols-outlined">
                      arrow_upward
                    </span>
                  </button>
                </div>
                <div className={styles.advertisementImg}>
                  <img
                    src={uploadedImage ? uploadedImage : getEventPicture(item._id)}
                    alt={item.name}
                    style={{ borderRadius: '10px' }}
                    width="70" height="70"
                  />
                </div>
              </div>
              <div
                className={styles.contentDivider}
                style={{
                  width: '56%',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignContent: 'center',
                }}
              >
                <span style={{ width: '100%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Event Name
                  </div>
                  <div className={styles.inputContainer} style={{ width: '50%' }}>
                    <input
                      className={styles.input}
                      type="text"
                      value={item.name}
                      placeholder="Type name"
                      onBlur={() => {}}
                      onChange={(e) => handleItemChange('name',e.target.value)}
                    />
                  </div>
                </span>
                <span style={{ width: '100%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Description
                  </div>
                  <div className={styles.inputContainer} style={{ width: '80%', marginBottom: '0px' }}>
                    <textarea
                      className={styles.input}
                      style={{ width: '100%', height: '60px', resize: 'none' }}
                      cols="20" rows="1"
                      value={item.description}
                      placeholder="Description 140 characters"
                      onBlur={() => {}}
                      onChange={(e) => handleItemChange('description',e.target.value)}
                    />
                  </div>
                </span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Start time, end time and location
                  </div>
                  <div className={styles.gridContainer}>
                    <DemoContainer components={['DateTimePicker']} sx={{ width: '100%' }} >
                      <DateTimePicker
                        sx={{
                          display: 'flex',
                          background: '#FCFCFC',
                          borderRadius: '10px !important',

                          boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702',
                          boxShadow: '0px 4.679279327392578px 4.679279327392578px 0px #00000014',
                          // maxWidth: '500px',
                          // width: '50%',
                          minHeight: '28px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            border: 'none',
                            borderRadius: '10px'
                          },
                          '& .MuiInputLabel-root': {
                            transformOrigin: '0px 35px'
                          },
                        }}
                        value={item.startDate}
                        label="Start time" 
                        maxDateTime={item.endDate}
                        minDateTime={moment()}
                        onChange={(newValue) => handleItemChange('startDate', newValue)}
                      />
                    </DemoContainer>
                    <DemoContainer components={['DateTimePicker']} sx={{ width: '100%' }} >
                      <DateTimePicker
                        value={item.endDate}
                        label="End time"
                        sx={{
                          display: 'flex',
                          background: '#FCFCFC',
                          borderRadius: '10px',
                          boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702',
                          boxShadow: '0px 4.679279327392578px 4.679279327392578px 0px #00000014',
                          minHeight: '28px',
                          '& .MuiOutlinedInput-notchedOutline': {
                            border: 'none'
                          },
                          '& .MuiInputLabel-root': {
                            transformOrigin: '0px 35px'
                          },
                        }}
                        minDateTime={item.startDate}
                        onChange={(newValue) => handleItemChange('endDate', newValue)}
                      />
                    </DemoContainer>
                    <div style={{ width: '86.5%', margin: '7px 0 0 0' }}>
                      <MTBSelector
                        onBlur={() => ("state")}
                        name={"state"}
                        placeholder='State'
                        autoComplete='State'
                        value={item.state}
                        itemName={"name"}
                        itemValue={"name"}
                        options={states}
                        onChange={(selected, fieldName) => {
                          handleItemChange('state', selected);
                        }}
                        styles={{
                          display: 'flex',
                          background: '#FCFCFC',
                          borderRadius: '10px',
                          boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702',
                          boxShadow: '0px 4.679279327392578px 4.679279327392578px 0px #00000014',
                          width: '100%',
                          height: '28px',
                        }}
                      />
                    </div>
                    <div style={{ width: '86.5%', margin: '7px 0 0 0' }}>
                      <MTBSelector
                        onBlur={() => ("city")}
                        name={"city"}
                        placeholder='City'
                        autoComplete='City'
                        value={item.city}
                        itemName={"name"}
                        itemValue={"name"}
                        options={cities}
                        onChange={(selected, fieldName) => {
                          handleItemChange('city', selected);
                        }}
                        appearDisabled={!item.state}
                        styles={{
                          display: 'flex',
                          background: '#FCFCFC',
                          borderRadius: '10px',
                          boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702',
                          boxShadow: '0px 4.679279327392578px 4.679279327392578px 0px #00000014',
                          width: '100%',
                          height: '28px',
                        }}
                      />
                    </div>
                    <div className={styles.inputContainer} style={{ margin: '0 10px 10px 0', width: '93%' }}>
                      <input
                        className={styles.input}
                        type="text"
                        value={item.zipCode}
                        placeholder="Zip Code"
                        onBlur={() => {}}
                        onChange={(e) => handleItemChange('zipCode',e.target.value)}
                      />
                    </div>
                    <div className={styles.inputContainer} style={{ margin: '0 10px 10px 0', width: '93%' }}>
                      <input
                        className={styles.input}
                        type="text"
                        value={item.address1}
                        placeholder="Address1"
                        onBlur={() => {}}
                        onChange={(e) => handleItemChange('address1',e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
          <button
            className={createMultipleClasses([styles.baseButton, styles.createEventButton])}
            style={{ marginTop: '0px' }}
            onClick={_updateEvent}
          >
            Save Ad
          </button>
        </div>
      </div>
    </div>
 )
};

export default EventEdit;

