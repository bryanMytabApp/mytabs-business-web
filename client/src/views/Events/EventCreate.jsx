import React, { useEffect, useState } from "react";
import styles from './EventCreate.module.css'
import {
  IconButton,
  Divider
} from '@mui/material/'
import {toast} from "react-toastify";
import { DemoContainer } from '@mui/x-date-pickers/internals/demo';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import moment from 'moment'
import { useNavigate } from "react-router-dom";
import selectIcon from "../../assets/atoms/selectIcon.svg";
import selectIconActive from "../../assets/atoms/selectIconActive.svg";
import { MTBDropZone, MTBSelector } from "../../components";
import { State, City } from 'country-state-city';
import { createEvent, getPresignedUrlForEvent } from "../../services/eventService";
import axios from "axios";

const eventTypes = [
  {
    name: 'Event',
    icon: 'event_available',
    type: "0",
  },
]

const ticketingOptions = [
  { 
    value: 0, 
    name: "External link",
  },
  { 
    value: 1, 
    name: "Free",
  },
  { 
    value: 2, 
    name: "RSVP",
  },
];

let userId
const countryCode = 'US';
const baseTicket = {
  option: 'External link',
  type: '',
  error: false
}

const EventCreate = () => {
  const [selectedItem, setSelectedItem] = useState("")
  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])
  const [step, setStep] = useState(0)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [addressOption, setAddressOption] = useState(0)
  const [tickets, setTickets] = useState([baseTicket])
  const [ticketSelectedIndex, setTicketSelectedIndex] = useState(0)

  const [item, setItem] = useState({
    name: '',
    city: '',
    state: '',
    description: '',
    startDate: null,
    endDate: null,
    address1: '',
    address2: '',
    zipCode: '',
  })
  
  const navigation = useNavigate();
  
  const handleGoBack = () => navigation("/admin/my-events")
  
  const createMultipleClasses = (classes = []) => classes.filter(cl => cl).join(' ');
  
  const handleContinue = (nextStep, lastStep = false) => {
    if(!lastStep) {
      setStep(nextStep)
      return
    }
    if(!ticketsValidated()) {
      return
    }
    _createEvent()
  }

  const _createEvent = async () => {
    let itemCopy = Object.assign({}, item)
    itemCopy.startDate = moment(itemCopy.startDate).toString()
    itemCopy.endDate = moment(itemCopy.endDate).toString()
    itemCopy.userId = userId
    itemCopy.tickets = tickets
    let data
    try {
      let res = await createEvent(itemCopy)
      data = res.data
      toast.success("Event Created!");
    } catch (error) {
      toast.error("cannot create event");
      console.error(error);
      return
    }

    let presignedUrl
    try {
      let res = await getPresignedUrlForEvent(data._id)
      presignedUrl = res.data
      console.log("🚀 ~ const_createEvent= ~ presignedUrl:", presignedUrl)
    } catch (error) {
      toast.error("cannot create presigned url");
      console.error(error);
      return
    }

    const base64Response = await fetch(uploadedImage);
    const blob = await base64Response.blob();
    try {
      await axios.put(presignedUrl, blob)
      toast.success("image was successfully uploaded");
    } catch (error) {
      toast.error("cannot put image on");
      handleGoBack()
    }
    handleGoBack()
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

  const disabledButtonOnStepTwo = () => {
    return !item.name || !item.startDate || !item.endDate
  }

  const disabledButtonOnStepThree = () => {
    return addressOption === 1 && (!item.city || item.zipCode.length < 5 || !item.address1)
  }

  useEffect(() => {
    const token = localStorage.getItem("idToken");
    userId = parseJwt(token);
    let availableStates = State.getStatesOfCountry(countryCode);
    setStates(availableStates)
    console.log("🚀 ~ useEffect ~ availableStates:", availableStates)
  }, []);

  useEffect(() => {
    if(!item.state) {
      return
    }
    let selectedState = states.find(state => state.name === item.state)
    let availableCities = City.getCitiesOfState(countryCode, selectedState.isoCode)
    setCities(availableCities)
  }, [item.state])

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

  const changeTicketSelectedAttr = (attr, value) => {
    let selectedTicketCopy = tickets[ticketSelectedIndex]
    selectedTicketCopy = {
      ...selectedTicketCopy,
      [attr]: value
    }
    selectedTicketCopy = validateTicket(selectedTicketCopy)
    let ticketsCopy = JSON.parse(JSON.stringify(tickets))
    ticketsCopy[ticketSelectedIndex] = selectedTicketCopy
    setTickets(ticketsCopy)
  }

  const addNewTicket = () => {
    let ticketsCopy = JSON.parse(JSON.stringify(tickets))
    ticketsCopy.push(Object.assign({}, baseTicket))
    
    setTickets(ticketsCopy)
    setTicketSelectedIndex(ticketsCopy.length - 1)
  }

  const deleteTicket = (ticketIndex) => {
    if(tickets.length === 1) {
      return
    } 
    let ticketsCopy = JSON.parse(JSON.stringify(tickets))
    ticketsCopy.splice(ticketIndex, 1)
    setTickets(ticketsCopy)
    setTicketSelectedIndex(0)
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

 return (
  <div className={styles.view}>
    <div className={styles.titleContainer}>
      <IconButton aria-label="delete" onClick={handleGoBack}>
        <ArrowBackIcon />
      </IconButton>
      <h1>
        My Ads
      </h1>
    </div>
    <div className={styles.contentContainer}>
      <div className={styles.tableContainer} style={{ position: 'relative' }}>
        {step !== 0 && (
          <div
            style={{
              position: 'absolute',
              top: '5px',
              left: '5px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer'
            }}
            onClick={() => setStep(prev => prev -1)}
          >
            <IconButton aria-label="delete">
              <ArrowBackIcon />
            </IconButton>
            <div style={{
              fontFamily: 'Outfit',
              fontSize: '15px',
              fontWeight: '500',
              lineHeight: '21.13px',
              textAlign: 'left',
              color: '#676565',
            }}>
              GO BACK
            </div>
          </div>
        )}
        {step === 0 && (
          <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'column',
            }}
          >
            <h5 className={styles.title}>
              What type of ad would you like to create?
            </h5>
            <div className={styles.eventsContainer}>
              {eventTypes.map(event => (
                <div
                  onClick={() => setSelectedItem(event.type)}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "180px",
                    height: "180px",
                    backgroundColor: "white",
                    borderRadius: "15%",
                    flexDirection: "column",
                  }}>
                  <div
                    style={{
                      position: "absolute",
                      top: "2px",
                      right: "2px",
                      padding: "5px",
                    }}>
                    <img
                      style={{justifySelf: "flex-end"}}
                      src={selectedItem === event.type ? selectIconActive : selectIcon}
                      alt='bullet'
                    />
                  </div>
                  <div
                    style={{
                      textAlign: "center",
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      fontSize: "16px",
                      fontWeight: 500,
                      fontFamily: "Outfit",
                      color: selectedItem === event.type ? "#00AAD7" : "#676565",
                      boxShadow: "0px 4.679279327392578px 9.358558654785156px 0px #32324702",
                      boxShadow: "0px 4.679279327392578px 4.679279327392578px 0px #00000014",
                    }}>
                      <span class="material-symbols-outlined"
                        style={{
                          color: selectedItem === event.type ? "#00AAD7" : "",
                          fontSize: "50px",
                        }}
                      >
                        {event.icon}
                      </span>
                    {/* <Icon path={iconPath} size={"40px"} color={clicked ? "#00AAD7" : "#919797"} /> */}
                    {event.name}
                  </div>
                </div>
              ))}
            </div>
            <button
              disabled={!selectedItem}
              className={createMultipleClasses([styles.baseButton, styles.createEventButton, !selectedItem ? styles.disabled : ''])}
              onClick={() => handleContinue(1)}
            >
              Next
            </button>
          </div>
        )}
        {step === 1 && (
          <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'column',
              width: '710px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%',marginBottom: '30px' }}>
              <span style={{ width: '100%' }}>
                <div className={styles.title}>
                  Whats the name of your event?
                </div>
                <div className={styles.inputContainer} style={{ width: '100%' }}>
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
            </div>
            <Divider variant="middle" flexItem color="#CFF4FC" />
            <div className={styles.title} style={{ marginTop: '10px' }}>
              When does your event start and end?
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexDirection: 'column', width: '100%',marginBottom: '30px' }}>
              <div style={{ width: '100%', display: 'flex', marginTop: '10px', justifyContent: 'space-between' }}>
                <DemoContainer components={['DateTimePicker']} sx={{ width: '48%' }} >
                  <DateTimePicker
                    sx={{
                      display: 'flex',
                      background: '#FCFCFC',
                      borderRadius: '10px',
                      boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702',
                      boxShadow: '0px 4.679279327392578px 4.679279327392578px 0px #00000014',
                      // maxWidth: '500px',
                      // width: '50%',
                      minHeight: '28px',
                      '& .MuiOutlinedInput-notchedOutline': {
                        border: 'none'
                      },
                      '& .MuiInputLabel-root': {
                        transformOrigin: '0px 35px'
                      }
                    }}
                    value={item.startDate}
                    label="Start time" 
                    maxDateTime={item.endDate ? item.endDate : null}
                    minDateTime={moment()}
                    onChange={(newValue) => handleItemChange('startDate',newValue)}
                  />
                </DemoContainer>
                <DemoContainer components={['DateTimePicker']} sx={{ width: '48%' }} >
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
                      }
                    }}
                    minDateTime={item.startDate ? item.startDate : moment()}
                    onChange={(newValue) => handleItemChange('endDate',newValue)}
                  />
                </DemoContainer>
              </div>
            </div>
            <button
              disabled={disabledButtonOnStepTwo()}
              className={createMultipleClasses([styles.baseButton, styles.createEventButton, disabledButtonOnStepTwo() ? styles.disabled : ''])}
              onClick={() => handleContinue(2)}
            >
              Next
            </button>
          </div>
        )}
        {step === 2 && (
          <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'column',
              width: '710px',
            }}
          >
            <span style={{ width: '100%' }}>
              <div className={styles.title}>
                Add a description or relevant information
              </div>
              <div className={styles.inputContainer} style={{ width: '100%', marginBottom: '10px' }}>
                <textarea
                  className={styles.input}
                  style={{ width: '100%', height: '80px', resize: 'none' }}
                  cols="20" rows="1"
                  value={item.description}
                  placeholder="Description 140 characters"
                  onBlur={() => {}}
                  onChange={(e) => handleItemChange('description',e.target.value)}
                />
              </div>
            </span>
            <div style={{ width: '100%' }}>
              <div className={styles.title}>
                Where is it located
              </div>
              <span
                style={{ width: '100%', display: 'flex', cursor: 'pointer', }}
                onClick={() => setAddressOption(0)}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    background: 'white',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    boxShadow: '0px 0px 0px 4px #98A2B324',
                    marginRight: '10px',
                    marginBottom: '20px'
                  }}
                >
                  <div>
                    <img
                      style={{justifySelf: "flex-end"}}
                      src={addressOption === 0 ? selectIconActive : selectIcon}
                      alt='bullet'
                    />
                  </div>
                </div>
                <div>
                  Business address
                </div>
              </span>
              <span
                style={{ width: '100%', display: 'flex', cursor: 'pointer', }}
                onClick={() => setAddressOption(1)}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    background: 'white',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    boxShadow: '0px 0px 0px 4px #98A2B324',
                    marginRight: '10px',
                    marginBottom: '10px',
                  }}
                >
                  <div>
                    <img
                      style={{justifySelf: "flex-end"}}
                      src={addressOption === 1 ? selectIconActive : selectIcon}
                      alt='bullet'
                    />
                  </div>
                </div>
                <div>
                  New address
                </div>
              </span>
              {addressOption === 1 && (
                <span style={{ width: '100%' }}>
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                    <div className={styles.inputContainer} style={{ margin: '0 10px 10px 0', width: '47%' }}>
                      <input
                        className={styles.input}
                        type="text"
                        value={item.address1}
                        placeholder="Address1"
                        onBlur={() => {}}
                        onChange={(e) => handleItemChange('address1',e.target.value)}
                      />
                    </div>
                    <span style={{ width: '47%' }}>
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
                    </span>
                  </div>
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
                    <div className={styles.inputContainer} style={{ width: '47%' }}>
                      <input
                        className={styles.input}
                        type="text"
                        value={item.zipCode}
                        placeholder="Zip Code"
                        onBlur={() => {}}
                        onChange={(e) => handleItemChange('zipCode',e.target.value)}
                      />
                    </div>
                    <span style={{ width: '47%' }}>
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
                    </span>
                  </div>
                </span>              
              )}
            </div>
            <button
              disabled={disabledButtonOnStepThree()}
              className={createMultipleClasses([styles.baseButton, styles.createEventButton, disabledButtonOnStepThree() ? styles.disabled : ''])}
              onClick={() => handleContinue(3)}
            >
              Next
            </button>
          </div>
        )}
        {step === 3 && (
          <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'column',
              width: '710px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%',marginBottom: '30px' }}>
              <span style={{ width: '100%' }}>
                <div className={styles.title}>
                  Upload the advertisement for your event
                </div>
                <MTBDropZone
                  fileType={"image"}
                  setFile={setUploadedImage}
                  uploadedImage={uploadedImage}
                  // helper={
                  //   errors.uploadedImage ? {type: "warning", text: errors.uploadedImage} : undefined
                  // }
                />
              </span>
            </div>
            <button
              disabled={!uploadedImage}
              className={createMultipleClasses([styles.baseButton, styles.createEventButton, !uploadedImage ? styles.disabled : ''])}
              onClick={() => handleContinue(4, false)}
            >
              Next
            </button>
          </div>
        )}
        {step === 4 && (
          <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexDirection: 'column',
              width: '100%',
              height: '90%',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', marginBottom: '30px', height: '100%', alignContent: 'space-between' }}>
              <span className={styles['tickets-viewer-container']}>
                <div className={styles['ticket-list-container']}>
                  {tickets.map((ticket, index) => (
                    <div
                      className={styles['individual-ticket-container']}
                    >
                      <span
                        style={{
                          width: '100%',
                          display: 'flex',
                          cursor: 'pointer',
                          alignItems: 'center'
                        }}
                        onClick={() => setTicketSelectedIndex(index)}
                      >
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            background: 'white',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            boxShadow: '0px 0px 0px 4px #98A2B324',
                            marginRight: '10px',
                          }}
                        >
                          <div>
                            <img
                              style={{justifySelf: "flex-end"}}
                              src={ticketSelectedIndex === index ? selectIconActive : selectIcon}
                              alt='bullet'
                            />
                          </div>
                        </div>
                        <div>
                          <div
                            className={
                              createMultipleClasses([
                                styles['outfit-font'],
                              ])
                            }
                            style={{
                              fontWeight: 800,
                              color: ticket.error ? 'red' : ticketSelectedIndex === index ? '#00AAD6' : '#514F4F'
                            }}
                          >
                            Ticket {index <= 8 ? `0${index + 1}` : index + 1}
                          </div>
                          <div className={createMultipleClasses([styles['outfit-font']])}>
                            {ticket.option}
                          </div>
                        </div>
                      </span>
                      <div className={styles['delete-icon']} onClick={() => deleteTicket(index)}>
                        <span className={createMultipleClasses([
                          'material-symbols-outlined',
                          tickets.length === 1 ? styles['disabled'] : ''
                        ])}>
                          delete
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className={createMultipleClasses([styles['add-another-ticket-container'], styles['primary-color']])}
                  onClick={addNewTicket}
                >
                  <span className={styles['add-another-ticket-text']}>Add another ticketing option?</span >
                  <span class="material-symbols-outlined">
                    add
                  </span>
                </div>
              </span>
              <span style={{ width: '50%' }}>
                <span>
                  <div className={styles.title} style={{ marginBottom: 0, fontWeight: 700 }}>
                    Select ticketing options
                  </div>
                  <MTBSelector
                    onBlur={() => ("name")}
                    name={"name"}
                    placeholder='Type'
                    value={tickets[ticketSelectedIndex].option}
                    itemName={"name"}
                    itemValue={"name"}
                    options={ticketingOptions}
                    onChange={(selected, fieldName) => {
                      changeTicketSelectedAttr('option', selected);
                    }}
                    styles={{
                      display: 'flex',
                      background: '#FCFCFC',
                      borderRadius: '10px',
                      boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702',
                      boxShadow: '0px 4.679279327392578px 4.679279327392578px 0px #00000014',
                      width: '40%',
                      height: '18px',
                    }}
                  />
                </span>
                <span>
                  <div style={{ marginBottom: '10px', marginTop: '10px' }}>
                    Type of ticket
                  </div>
                  <div className={styles.inputContainer} style={{ width: '100%', padding: '5px 10px' }}>
                    <input
                      className={styles.input}
                      type="text"
                      value={tickets[ticketSelectedIndex].type}
                      placeholder="Type your ‘Type of ticket’"
                      onBlur={() => {}}
                      onChange={(e) => changeTicketSelectedAttr('type',e.target.value)}
                    />
                  </div>
                  {tickets[ticketSelectedIndex]?.option === 'External link' && (
                    <div>
                      <div className={styles.title} style={{ marginBottom: '7px', fontWeight: 700 }}>
                        Add external links
                      </div>
                      <div className={styles.inputContainer} style={{ width: '100%', marginBottom: '10px', padding: '5px 10px' }}>
                        <input
                          className={styles.input}
                          type="text"
                          value={tickets[ticketSelectedIndex].link1 || ''}
                          placeholder="Link 1"
                          onBlur={() => {}}
                          onChange={(e) => changeTicketSelectedAttr('link1',e.target.value)}
                        />
                      </div>
                      <div className={styles.inputContainer} style={{ width: '100%', marginBottom: '10px', padding: '5px 10px' }}>
                        <input
                          className={styles.input}
                          type="text"
                          value={tickets[ticketSelectedIndex].link2 || ''}
                          placeholder="Link 2"
                          onBlur={() => {}}
                          onChange={(e) => changeTicketSelectedAttr('link2',e.target.value)}
                        />
                      </div>
                      <div className={styles.inputContainer} style={{ width: '100%', padding: '5px 10px' }}>
                        <input
                          className={styles.input}
                          type="text"
                          value={tickets[ticketSelectedIndex].link3 || ''}
                          placeholder="Link 3"
                          onBlur={() => {}}
                          onChange={(e) => changeTicketSelectedAttr('link3',e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  {(tickets[ticketSelectedIndex]?.option === 'Free' || tickets[ticketSelectedIndex].option === 'RSVP') && (
                    <div>
                      <span style={{ width: '100%' }}>
                        <div className={styles.title} style={{ fontWeight: 700, marginBottom: 0,marginTop: '15px' }}>
                          Add additional information
                        </div>
                        <div className={styles.inputContainer} style={{ width: '100%', marginBottom: '10px', padding: '5px 10px' }}>
                          <textarea
                            className={styles.input}
                            style={{ width: '100%', height: '80px', resize: 'none' }}
                            cols="20" rows="1"
                            value={tickets[ticketSelectedIndex].description || ''}
                            placeholder="Type your additional information..."
                            onBlur={() => {}}
                            onChange={(e) => changeTicketSelectedAttr('description',e.target.value)}
                          />
                        </div>
                      </span>
                    </div>
                  )}
                </span>
              </span>
            </div>
            <button
              className={createMultipleClasses([styles.baseButton, styles.createEventButton])}
              style={{ marginTop: '0px' }}
              onClick={() => handleContinue(4, true)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
 )
};

export default EventCreate;

