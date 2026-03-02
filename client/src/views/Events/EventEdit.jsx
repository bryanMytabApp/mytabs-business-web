import React, { useEffect, useRef, useState } from "react";
import styles from './EventEdit.module.css'
import {
  IconButton,
} from '@mui/material/'
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import moment from 'moment'
import { useNavigate, useParams } from "react-router-dom";
import { getEvent, getPresignedUrlForEvent, updateEvent } from "../../services/eventService";
import { getBusiness } from "../../services/businessService";
import { getEventPicture } from "../../utils/common"
import { toast } from "react-toastify";
import { State, City } from 'country-state-city';
import { MTBSelector, EventEditTickets } from "../../components";
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { processImage } from "../../components/MTBDropZone/MTBDropZone";
import axios from "axios";

const countryCode = 'US';
let userId

const EventEdit = () => {
  const [states, setStates] = useState([])
  const [item, setItem] = useState({})
  const [tickets, setTickets] = useState([])
  const [cities, setCities] = useState([])
  const [editScreen, setEditScreen] = useState(0)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [hasChanged, setHasChanged] = useState(false)
  const [businessData, setBusinessData] = useState(null)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const startTimeInputRef = useRef(null)
  const endTimeInputRef = useRef(null)
  const routeProps = useParams()

  const navigation = useNavigate();

  const handleGoBack = () => navigation("/admin/my-events")

  const createMultipleClasses = (classes = []) => classes.filter(cl => cl).join(' ');

  const parseJwt = (token) => {
    if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
      console.warn('Invalid or missing JWT token in EventEdit');
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

  const init = () => {
    let { eventId } = routeProps
    if(!eventId || !userId) {
      return
    }
    
    // Fetch event data
    getEvent(userId, eventId)
      .then(res => {
        let item = res.data
        item.startDate = moment(item.startDate)
        item.endDate = moment(item.endDate)
        setItem(item)
        setTickets(item.tickets || [])
      })
      .catch(err => console.error(err))
    
    // Fetch business data for address and tax calculation
    getBusiness(userId)
      .then(res => {
        console.log('🏢 Business data fetched:', res.data);
        setBusinessData(res.data)
      })
      .catch(err => {
        console.error('❌ Error fetching business data:', err);
        // Don't show error to user as business data is optional
      })
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
    if(attr === 'startDate' || attr === 'endDate') {
      setHasChanged(true)
    }
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
    
    console.log('🔄 Saving event with tickets in this order:', tickets.map((t, i) => ({ index: i, type: t.type, option: t.option })));
    
    let itemCopy = Object.assign({}, item)
    itemCopy.startDate = moment(itemCopy.startDate).toString()
    itemCopy.endDate = moment(itemCopy.endDate).toString()
    itemCopy.tickets = tickets
    itemCopy.timeChanged = hasChanged

    console.log('🔄 itemCopy.tickets being sent to server:', itemCopy.tickets.map((t, i) => ({ index: i, type: t.type, option: t.option })));

    let data
    try {
      let res = await updateEvent(itemCopy)
      data = res.data
      toast.success("Saved changes!");
      
      // Update the local item state with the saved data to prevent re-fetch from overriding
      if (data && data.tickets) {
        console.log('🔄 Server returned tickets in this order:', data.tickets.map((t, i) => ({ index: i, type: t.type, option: t.option })));
        // Update local state with server response to maintain order
        let updatedItem = { ...item };
        updatedItem.startDate = moment(data.startDate);
        updatedItem.endDate = moment(data.endDate);
        setItem(updatedItem);
        setTickets(data.tickets || []);
      }
      
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
          
          {/* Sliding Container */}
          <div className={styles.slidingContainer}>
            <div 
              className={styles.slidingContent}
              style={{
                transform: `translateX(${editScreen === 0 ? '0%' : '-50%'})`,
                transition: 'transform 0.3s ease-in-out'
              }}
            >
              {/* General Details Panel */}
              <div className={styles.slidePanel}>
                <div style={{
                    display: 'flex',
                    width: '100%',
                    justifyContent: 'center',
                    alignItems: 'top',
                    height: '90%',
                  }}
                >
                  <div
                    className={createMultipleClasses([styles.contentDivider, styles.leftMainContainer])}
                    style={{
                      width: '35%',
                      position: 'relative'
                    }}
                  >
                    <div className={styles.advertisementImg} >
                      <img
                        src={uploadedImage ? uploadedImage : getEventPicture(item._id)}
                        alt={item.name}
                        style={{ borderRadius: '10px' }}
                        width="340" 
                      ></img>
                      <button
                        className={createMultipleClasses([
                          styles.baseButton,
                          styles.buttonAbsolute,
                          styles['primary-background']
                        ])}
                        onClick={uploadFile}
                      >
                        Upload
                        <span className="material-symbols-outlined">
                          arrow_upward
                        </span>
                      </button>
                    </div>
                  
                  </div>
                  <div
                    className={styles.contentDivider}
                    style={{
                      width: '56%',
                      display: 'flex',
                      flexWrap: 'wrap'
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
                        {/* Date Picker - Full Width */}
                        <div style={{ width: '100%', marginBottom: '10px' }}>
                          <DatePicker
                            open={datePickerOpen}
                            onOpen={() => setDatePickerOpen(true)}
                            onClose={() => setDatePickerOpen(false)}
                            minDate={moment()}
                            sx={{
                              width: '100%',
                              background: '#FCFCFC',
                              borderRadius: '10px',
                              boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702',
                              '& .MuiOutlinedInput-notchedOutline': {
                                border: 'none'
                              },
                              '& .MuiIconButton-root': {
                                padding: '8px',
                                marginRight: '4px'
                              },
                              '& .MuiSvgIcon-root': {
                                fontSize: '24px',
                                color: '#666'
                              },
                              '& .MuiInputBase-input': {
                                cursor: 'pointer'
                              }
                            }}
                            slotProps={{
                              textField: {
                                placeholder: 'MM/DD/YYYY',
                                onClick: () => setDatePickerOpen(true),
                                InputProps: {
                                  style: {
                                    padding: '0',
                                    fontSize: '16px',
                                    cursor: 'pointer'
                                  }
                                },
                                inputProps: {
                                  style: {
                                    padding: '16px 14px',
                                    fontSize: '16px',
                                    cursor: 'pointer'
                                  },
                                  readOnly: true
                                }
                              }
                            }}
                            value={item.startDate}
                            onChange={(newValue) => {
                              const newStart = moment(newValue).hour(item.startDate ? moment(item.startDate).hour() : 12).minute(item.startDate ? moment(item.startDate).minute() : 0);
                              const newEnd = moment(newValue).hour(item.endDate ? moment(item.endDate).hour() : 14).minute(item.endDate ? moment(item.endDate).minute() : 0);
                              handleItemChange('startDate', newStart);
                              handleItemChange('endDate', newEnd);
                            }}
                          />
                        </div>

                        {/* Start and End Time - On Same Line */}
                        <div style={{ width: '100%', display: 'flex', gap: '20px', marginBottom: '10px' }}>
                          {/* Start Time */}
                          <div style={{ flex: '1' }}>
                            <div 
                              className={styles.inputContainer} 
                              onClick={() => startTimeInputRef.current?.showPicker?.()}
                              style={{ 
                                width: '100%',
                                padding: '14px',
                                minHeight: '56px',
                                display: 'flex',
                                alignItems: 'center',
                                position: 'relative',
                                cursor: 'pointer'
                              }}>
                              <input
                                ref={startTimeInputRef}
                                className={styles.input}
                                type="time"
                                value={item.startDate ? moment(item.startDate).format('HH:mm') : ''}
                                onChange={(e) => {
                                  const [hours, minutes] = e.target.value.split(':');
                                  const updatedStart = moment(item.startDate || new Date()).hour(parseInt(hours)).minute(parseInt(minutes));
                                  handleItemChange('startDate', updatedStart);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.target.showPicker?.();
                                }}
                                style={{
                                  fontSize: '16px',
                                  fontFamily: 'Roboto, sans-serif',
                                  width: '100%',
                                  border: 'none',
                                  background: 'transparent',
                                  outline: 'none',
                                  cursor: 'pointer',
                                  paddingRight: '40px'
                                }}
                              />
                              <span 
                                className="material-icons" 
                                style={{ 
                                  position: 'absolute',
                                  right: '14px',
                                  color: '#666',
                                  fontSize: '24px',
                                  pointerEvents: 'none'
                                }}
                              >
                                schedule
                              </span>
                            </div>
                          </div>

                          {/* End Time */}
                          <div style={{ flex: '1' }}>
                            <div 
                              className={styles.inputContainer} 
                              onClick={() => endTimeInputRef.current?.showPicker?.()}
                              style={{ 
                                width: '100%',
                                padding: '14px',
                                minHeight: '56px',
                                display: 'flex',
                                alignItems: 'center',
                                position: 'relative',
                                cursor: 'pointer'
                              }}>
                              <input
                                ref={endTimeInputRef}
                                className={styles.input}
                                type="time"
                                value={item.endDate ? moment(item.endDate).format('HH:mm') : ''}
                                onChange={(e) => {
                                  const [hours, minutes] = e.target.value.split(':');
                                  const updatedEnd = moment(item.endDate || new Date()).hour(parseInt(hours)).minute(parseInt(minutes));
                                  handleItemChange('endDate', updatedEnd);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.target.showPicker?.();
                                }}
                                style={{
                                  fontSize: '16px',
                                  fontFamily: 'Roboto, sans-serif',
                                  width: '100%',
                                  border: 'none',
                                  background: 'transparent',
                                  outline: 'none',
                                  cursor: 'pointer',
                                  paddingRight: '40px'
                                }}
                              />
                              <span 
                                className="material-icons" 
                                style={{ 
                                  position: 'absolute',
                                  right: '14px',
                                  color: '#666',
                                  fontSize: '24px',
                                  pointerEvents: 'none'
                                }}
                              >
                                schedule
                              </span>
                            </div>
                          </div>
                        </div>
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
                            onChange={(selected) => {
                              handleItemChange('state', selected.name);
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
                            onChange={(selected) => {
                              handleItemChange('city', selected.name);
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
              </div>
              
              {/* Tickets Panel */}
              <div className={styles.slidePanel}>
                <EventEditTickets
                  tickets={tickets}
                  setTickets={setTickets}
                  eventInfo={item}
                  addressOption={0} // Using business address by default
                  businessData={businessData} // Pass the fetched business data
                  onTestPurchase={(taxAmount, taxBreakdown) => {
                    console.log('Test purchase clicked with tax:', { taxAmount, taxBreakdown });
                    // Handle test purchase functionality here
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        <button
          className={createMultipleClasses([styles.baseButton, styles.createEventButton])}
          onClick={_updateEvent}
        >
          Save Ad
        </button>
      </div>
    </div>
 )
};

export default EventEdit;

