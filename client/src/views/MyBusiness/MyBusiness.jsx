import axios from "axios";
import styles from './MyBusiness.module.css'
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { toast } from "react-toastify";
import { IconButton } from '@mui/material/'
import { MTBSelector } from "../../components";
import { getUserById } from "../../services/userService";
import { useNavigate } from "react-router-dom";
import { State, City } from 'country-state-city';
import { processImage } from "../../components/MTBDropZone/MTBDropZone";
import { createMultipleClasses, getBusinessPicture } from "../../utils/common"
import React, { useEffect, useRef, useState } from "react";
import { getBusiness, getPresignedUrlForBusiness, updateBusiness } from "../../services/businessService";
import QRCode from "react-qr-code";
import config from "../../config.json"

const countryCode = 'US';
let userId

const businessTypes = [
  {
    name: 'Entity/Individual',
    value: 0
  },
  {
    name: 'Group/Organization',
    value: 1
  },
  {
    name: 'Business/Corp',
    value: 2
  },
]

const MyBusiness = () => {
  const [states, setStates] = useState([])
  const [item, setItem] = useState({
    type: 'Entity/Individual'
  })
  const [tickets, setTickets] = useState([])
  const [cities, setCities] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [editScreen, setEditScreen] = useState(0)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [editEnabled, setEditEnabled] = useState(false)

  const navigation = useNavigate();

  const handleGoBack = () => navigation("/admin/home")

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
    getBusiness(userId)
      .then(res => {
        let item = res.data
        setItem(res.data)
      })
      .catch(err => console.error(err))
    getUserById(userId)
      .then(res => {
        let item = res.data
        let subcategories = item.subcategory.map(sub => {
          if(sub.text)
            return sub.text
          else if(sub.subcategories.length && sub.subcategories[0])
            return sub.subcategories[0]
          return sub.name
        })
        setSubcategories(subcategories)
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
    if(attr === 'phoneNumber' && (value.length > 10 || isNaN(value)) ) {
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
    let itemCopy = Object.assign({}, item)
    itemCopy.categories = subcategories
    itemCopy.userId = userId

    try {
      let res = await updateBusiness(itemCopy)
      if(res.data?._id) {
        setItem(res.data)
      }
      setEditEnabled(false)
      toast.success("Business updated successfully");
    } catch (error) {
      toast.error("Cannot save changes");
      console.error(error);
      return
    }
    if(uploadedImage) {
      let presignedUrl
      try {
        let res = await getPresignedUrlForBusiness(userId)
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
  }

  const handleClickEdit = () => {
    if(!editEnabled) {
      setEditEnabled(prev => !prev)
      return
    }
    _updateEvent()
  }

  const downloadQR = () => {
    const svg = document.getElementById("QRCode");
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = "QRCode";
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
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
          <h1>
            My Business
          </h1>
        </div>
        <div className={styles.tableContainer}>
          {/* <div className={styles.buttonsContainer}>
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
              Specific details
            </button>
          </div> */}
          <div
            className={createMultipleClasses([
              styles['sub-content-container'],
              styles['left-container'],
            ])}>
            <div
              className={styles['media-container']}
            >
              <div className={styles['sub-media-container']}>
                <img
                  src={uploadedImage ? uploadedImage : getBusinessPicture(userId)}
                  alt={item.name}
                  style={{ borderRadius: '10px' }}
                  width="200" height="160"
                />
                <button
                  className={createMultipleClasses([
                    styles.baseButton,
                    styles.buttonAbsolute2,
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
              <div className={styles['sub-media-container']}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '7px' }}>
                  <QRCode
                    size={236}
                    style={{ height: "auto", maxWidth: "60%", width: "60%" }}
                    value={`https://d2ys9ezg5r34qx.cloudfront.net/user/${userId}`}
                    id='QRCode'
                    viewBox={`0 0 256 256`}
                  />
                </div>
                <button
                  className={createMultipleClasses([
                    styles.baseButton,
                    styles.buttonAbsolute2,
                    styles['primary-background']
                  ])}
                  onClick={downloadQR}
                >
                  Download
                  <span class="material-symbols-outlined" style={{marginLeft: '10px'}}>
                    cloud_download
                  </span>
                </button>
              </div>
            </div>
          </div>
          <div
            className={createMultipleClasses([
              styles['sub-content-container'],
              styles['right-container']
            ])}
          >
            <div style={{ width: '100%',padding: '0 10%', boxSizing: 'border-box' }}>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ width: '55%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Business Name
                  </div>
                  <div
                    className={createMultipleClasses([
                      styles.inputContainer,
                      editEnabled ? '' : styles.disabled
                    ])}
                    style={{ width: '100%' }}
                  >
                    <input
                      className={createMultipleClasses([
                        styles.input,
                        editEnabled ? '' : styles.disabled
                      ])}
                      type="text"
                      value={item.name}
                      placeholder="Business Name Field"
                      onBlur={() => {}}
                      disabled={!editEnabled}
                      onChange={(e) => handleItemChange('name',e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ width: '35%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Designation
                  </div>
                  <div
                    className={createMultipleClasses([
                      styles.inputContainer,
                      editEnabled ? '' : styles.disabled
                    ])}
                    style={{ width: '100%' }}
                  >
                    <input
                      className={createMultipleClasses([
                        styles.input,
                        editEnabled ? '' : styles.disabled
                      ])}
                      type="text"
                      value={item.designation}
                      placeholder="Designation"
                      onBlur={() => {}}
                      disabled={!editEnabled}
                      onChange={(e) => handleItemChange('designation',e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ width: '48%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Business Type
                  </div>
                  <div style={{ width: '100%' }}>
                    <MTBSelector
                      onBlur={() => ("type")}
                      name={"type"}
                      placeholder='Business type'
                      autoComplete='State'
                      value={item.type}
                      itemName={"name"}
                      itemValue={"name"}
                      options={businessTypes}
                      onChange={(selected, fieldName) => {
                        handleItemChange('type', selected);
                      }}
                      appearDisabled={!editEnabled}
                      styles={{
                        display: 'flex',
                        background: '#FCFCFC',
                        borderRadius: '10px',
                        boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702',
                        boxShadow: '0px 4.679279327392578px 4.679279327392578px 0px #00000014',
                        width: '100%',
                        height: '50px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
                <div style={{ width: '48%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Phone Number
                  </div>
                  <div
                    className={createMultipleClasses([
                      styles.inputContainer,
                      editEnabled ? '' : styles.disabled
                    ])}
                    style={{ width: '100%' }}
                  >
                    <input
                      className={createMultipleClasses([
                        styles.input,
                        editEnabled ? '' : styles.disabled
                      ])}
                      type="text"
                      value={item.phoneNumber}
                      placeholder="Phone number"
                      onBlur={() => {}}
                      disabled={!editEnabled}
                      onChange={(e) => handleItemChange('phoneNumber',e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div style={{ width: '100%' }}>
                <div style={{ width: '100%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Description
                  </div>
                  <div
                    className={createMultipleClasses([
                      styles.inputContainer,
                      editEnabled ? '' : styles.disabled
                    ])}
                    style={{ marginBottom: '0px' }}
                  >
                    <textarea
                      className={createMultipleClasses([
                        styles.input,
                        editEnabled ? '' : styles.disabled
                      ])}
                      style={{ width: '100%', height: '60px', resize: 'none' }}
                      cols="20" rows="1"
                      value={item.description}
                      disabled={!editEnabled}
                      placeholder="Description 140 characters"
                      onBlur={() => {}}
                      onChange={(e) => handleItemChange('description',e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div style={{ width: '100%' }}>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ width: '48%' }}>
                    <div className={styles.title} style={{ marginBottom: 0 }}>
                      Location
                    </div>
                    <div style={{ width: '100%', margin: '7px 0 0 0' }}>
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
                        appearDisabled={!editEnabled}
                        styles={{
                          display: 'flex',
                          background: '#FCFCFC',
                          borderRadius: '10px',
                          boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702',
                          boxShadow: '0px 4.679279327392578px 4.679279327392578px 0px #00000014',
                          width: '100%',
                          height: '50px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ width: '48%' }}>
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
                      appearDisabled={!item.state || !editEnabled}
                      styles={{
                        display: 'flex',
                        background: '#FCFCFC',
                        borderRadius: '10px',
                        boxShadow: '0px 4.679279327392578px 9.358558654785156px 0px #32324702',
                        boxShadow: '0px 4.679279327392578px 4.679279327392578px 0px #00000014',
                        width: '100%',
                        height: '50px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ width: '100%', marginTop: '10px' }}>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div
                    className={createMultipleClasses([
                      styles.inputContainer,
                      editEnabled ? '' : styles.disabled
                    ])}
                    style={{ width: '48%' }}
                  >
                    <input
                      className={createMultipleClasses([
                        styles.input,
                        editEnabled ? '' : styles.disabled
                      ])}
                      type="text"
                      value={item.zipCode}
                      placeholder="Zip Code"
                      onBlur={() => {}}
                      disabled={!editEnabled}
                      onChange={(e) => handleItemChange('zipCode',e.target.value)}
                    />
                  </div>
                  <div
                    className={createMultipleClasses([
                      styles.inputContainer,
                      editEnabled ? '' : styles.disabled
                    ])}
                    style={{ width: '48%' }}
                  >
                    <input
                      className={createMultipleClasses([
                        styles.input,
                        editEnabled ? '' : styles.disabled
                      ])}
                      type="text"
                      value={item.address1}
                      placeholder="Street"
                      onBlur={() => {}}
                      disabled={!editEnabled}
                      onChange={(e) => handleItemChange('address1',e.target.value)}
                    />
                  </div>
                </div>
              </div>
              {item._id && (
                <div style={{ width: '100%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Categories
                  </div>
                  <div style={{ width: '100%', display: 'flex' }}>
                    {subcategories.map(sub => (
                      <div
                        className={createMultipleClasses([
                          styles['subcategory-container'],
                          editEnabled ? '' : styles.disabled
                        ])}
                      >
                        {sub}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div> 
          <button
            className={createMultipleClasses([
              styles.baseButton,
              styles.buttonAbsolute,
              styles['primary-background']
            ])}
            style={{ marginTop: '0px' }}
            onClick={handleClickEdit}
          >
            {editEnabled ? 'Save' : 'Edit'}
            <span class="material-symbols-outlined" style={{ fontSize: '17px', marginLeft: '5px' }}>
              {editEnabled ? 'save' : 'edit'}
            </span>
          </button>
        </div>
      </div>
    </div>
 )
};

export default MyBusiness;

