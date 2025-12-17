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
import { getBusiness, getPresignedUrlForBusiness, getPresignedUrlForGalleryPhoto, getPresignedUrlForMenu, updateBusiness } from "../../services/businessService";
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
  const [photoGallery, setPhotoGallery] = useState({
    gallery1: [],
    gallery2: [],
    gallery3: [],
    gallery4: []
  })
  const [menuFiles, setMenuFiles] = useState({
    menu1: null,
    menu2: null,
    menu3: null,
    menu4: null
  })

  const navigation = useNavigate();

  const handleGoBack = () => navigation("/admin/home")

  const parseJwt = (token) => {
    try {
      if (!token) {
        console.error('No token provided');
        return null;
      }
      const base64Url = token.split(".")[1];
      if (!base64Url) {
        console.error('Invalid token format');
        return null;
      }
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
      console.error('Error parsing JWT:', error);
      return null;
    }
  };
  
  const init = () => {
    getBusiness(userId)
      .then(res => {
        let item = res.data
        console.log('MENU DEBUG - Loading business data:', {
          menuUrl1: item.menuUrl1,
          menuUrl2: item.menuUrl2,
          menuUrl3: item.menuUrl3,
          menuUrl4: item.menuUrl4,
          menuLabel1: item.menuLabel1,
          menuLabel2: item.menuLabel2,
          menuLabel3: item.menuLabel3,
          menuLabel4: item.menuLabel4
        })
        setItem(res.data)
        
        // Load gallery photos from S3
        if (item.photoGallery) {
          const loadedGallery = {}
          Object.keys(item.photoGallery).forEach(galleryId => {
            const photoCount = item.photoGallery[galleryId]
            if (photoCount > 0) {
              loadedGallery[galleryId] = []
              for (let i = 0; i < photoCount; i++) {
                const photoUrl = `${config.bucketUrl}business/${userId}/gallery/${galleryId}/${i}`
                loadedGallery[galleryId].push({
                  preview: photoUrl,
                  category: galleryId
                })
              }
            }
          })
          setPhotoGallery(prev => ({
            ...prev,
            ...loadedGallery
          }))
        }
        
        // Menu URLs are already in the item state from the database
        // They will be displayed via item.menuUrl1, item.menuUrl2, etc.
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
    if (!token) {
      console.error('No authentication token found. Please log in.');
      navigation("/login");
      return;
    }
    userId = parseJwt(token);
    if (!userId) {
      console.error('Failed to parse user ID from token. Please log in again.');
      navigation("/login");
      return;
    }
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

  // Initialize Google Places Autocomplete for address input
  useEffect(() => {
    if (!addressInputRef.current || !window.google || !editEnabled) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(
      addressInputRef.current,
      {
        types: ['address'],
        componentRestrictions: { country: 'us' }
      }
    );

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace();
      
      if (!place.address_components) return;

      let streetNumber = '';
      let route = '';
      let city = '';
      let state = '';
      let zipCode = '';

      place.address_components.forEach(component => {
        const types = component.types;
        
        if (types.includes('street_number')) {
          streetNumber = component.long_name;
        }
        if (types.includes('route')) {
          route = component.long_name;
        }
        if (types.includes('locality')) {
          city = component.long_name;
        }
        if (types.includes('administrative_area_level_1')) {
          state = component.long_name;
        }
        if (types.includes('postal_code')) {
          zipCode = component.long_name;
        }
      });

      const fullAddress = `${streetNumber} ${route}`.trim();

      setItem(prev => ({
        ...prev,
        address1: fullAddress,
        city: city,
        state: state,
        zipCode: zipCode
      }));
    });

    return () => {
      if (autocompleteRef.current) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [editEnabled]);

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
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const menuInputRefs = useRef({
    menu1: null,
    menu2: null,
    menu3: null,
    menu4: null
  });

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

  const handlePhotoUpload = async (e, category) => {
    const files = Array.from(e.target.files)
    const processedImages = []
    
    for (let file of files) {
      const processedImageUrl = await processImage(URL.createObjectURL(file), 30)
      processedImages.push({
        file,
        preview: processedImageUrl,
        category
      })
    }
    
    setPhotoGallery(prev => ({
      ...prev,
      [category]: [...prev[category], ...processedImages]
    }))
  }

  const removePhoto = (category, index) => {
    setPhotoGallery(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index)
    }))
  }

  const handleMenuUpload = async (e, menuNum) => {
    window.MENU_UPLOAD_CALLED = true;
    window.MENU_UPLOAD_DATA = { menuNum, hasFiles: !!e.target.files[0] };
    
    const file = e.target.files[0]
    if (!file) {
      window.MENU_UPLOAD_DATA.error = 'No file';
      return
    }
    
    window.MENU_UPLOAD_DATA.fileName = file.name;
    
    // Store the file for upload
    setMenuFiles(prev => ({
      ...prev,
      [`menu${menuNum}`]: file
    }))
    
    // Create a preview URL and update the item
    const fileUrl = URL.createObjectURL(file)
    handleItemChange(`menuUrl${menuNum}`, fileUrl)
    
    toast.info(`Menu ${menuNum} ready to upload. Click "Save Changes" to upload.`)
    window.MENU_UPLOAD_DATA.success = true;
  }

  const _updateEvent = async () => {
    let itemCopy = Object.assign({}, item)
    itemCopy.categories = subcategories
    itemCopy.userId = userId

    // Prepare gallery photo metadata
    const galleryPhotos = {}
    Object.keys(photoGallery).forEach(galleryId => {
      if (photoGallery[galleryId] && photoGallery[galleryId].length > 0) {
        galleryPhotos[galleryId] = photoGallery[galleryId].length
      }
    })
    itemCopy.photoGallery = galleryPhotos
    
    // Prepare menu URLs - set them to S3 paths if files are pending upload
    for (let menuNum = 1; menuNum <= 4; menuNum++) {
      if (menuFiles[`menu${menuNum}`]) {
        itemCopy[`menuUrl${menuNum}`] = `${config.bucketUrl}business/${userId}/menu${menuNum}`
      }
    }
    
    console.log('MENU DEBUG - Saving business with data:', {
      menuUrl1: itemCopy.menuUrl1,
      menuUrl2: itemCopy.menuUrl2,
      menuUrl3: itemCopy.menuUrl3,
      menuUrl4: itemCopy.menuUrl4,
      menuLabel1: itemCopy.menuLabel1,
      menuLabel2: itemCopy.menuLabel2,
      menuLabel3: itemCopy.menuLabel3,
      menuLabel4: itemCopy.menuLabel4,
      menuFiles: Object.keys(menuFiles).filter(k => menuFiles[k])
    })

    try {
      let res = await updateBusiness(itemCopy)
      console.log('MENU DEBUG - Update response:', res.data)
      if(res.data?._id) {
        setItem(res.data)
      }
      setEditEnabled(false)
      toast.success("Business updated successfully");
    } catch (error) {
      toast.error("Cannot save changes");
      console.error('MENU DEBUG - Update error:', error);
      return
    }

    // Upload business logo
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
        toast.success("Logo uploaded successfully");
      } catch (error) {
        toast.error("Cannot upload logo");
      }
    }

    // Upload gallery photos
    for (const galleryId of Object.keys(photoGallery)) {
      const photos = photoGallery[galleryId]
      if (photos && photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i]
          if (photo.file) {
            try {
              const res = await getPresignedUrlForGalleryPhoto(userId, galleryId, i)
              const presignedUrl = res.data
              
              const base64Response = await fetch(photo.preview)
              const blob = await base64Response.blob()
              
              await axios.put(presignedUrl, blob)
            } catch (error) {
              console.error(`Failed to upload photo ${i} in ${galleryId}:`, error)
              toast.error(`Failed to upload some gallery photos`)
            }
          }
        }
      }
    }
    
    if (Object.keys(photoGallery).some(key => photoGallery[key]?.length > 0)) {
      toast.success("Gallery photos uploaded successfully");
    }

    // Upload menu files
    for (let menuNum = 1; menuNum <= 4; menuNum++) {
      const menuFile = menuFiles[`menu${menuNum}`]
      if (menuFile) {
        try {
          const res = await getPresignedUrlForMenu(userId, menuNum)
          const presignedUrl = res.data
          
          await axios.put(presignedUrl, menuFile, {
            headers: {
              'Content-Type': menuFile.type
            }
          })
          
          toast.success(`Menu ${menuNum} uploaded successfully`)
          
          // Clear the file from state after successful upload
          setMenuFiles(prev => ({
            ...prev,
            [`menu${menuNum}`]: null
          }))
        } catch (error) {
          console.error(`Failed to upload menu ${menuNum}:`, error)
          toast.error(`Failed to upload menu ${menuNum}`)
        }
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
                    value={`https://keeptabs.app/business/${item._id}`}
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
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ width: '48%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Website
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
                      type="url"
                      value={item.website || ''}
                      placeholder="https://example.com"
                      onBlur={() => {}}
                      disabled={!editEnabled}
                      onChange={(e) => handleItemChange('website',e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ width: '48%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Show Location Info
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', height: '50px', paddingLeft: '10px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', marginRight: '20px', cursor: editEnabled ? 'pointer' : 'not-allowed' }}>
                      <input
                        type="radio"
                        name="showLocation"
                        value="yes"
                        checked={item.showLocation !== false}
                        disabled={!editEnabled}
                        onChange={() => handleItemChange('showLocation', true)}
                        style={{ marginRight: '5px' }}
                      />
                      <span style={{ color: editEnabled ? '#333' : '#999' }}>Yes</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: editEnabled ? 'pointer' : 'not-allowed' }}>
                      <input
                        type="radio"
                        name="showLocation"
                        value="no"
                        checked={item.showLocation === false}
                        disabled={!editEnabled}
                        onChange={() => handleItemChange('showLocation', false)}
                        style={{ marginRight: '5px' }}
                      />
                      <span style={{ color: editEnabled ? '#333' : '#999' }}>No</span>
                    </label>
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
                      ref={addressInputRef}
                      className={createMultipleClasses([
                        styles.input,
                        editEnabled ? '' : styles.disabled
                      ])}
                      type="text"
                      value={item.address1}
                      placeholder="Start typing address..."
                      onBlur={() => {}}
                      disabled={!editEnabled}
                      onChange={(e) => handleItemChange('address1',e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div style={{ width: '100%', marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Categories
                  </div>
                  <div style={{ fontSize: '14px', color: subcategories.length >= 3 ? '#FF6B6B' : '#666' }}>
                    {subcategories.length}/3 selected
                  </div>
                </div>
                <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {['Music', 'Food', 'Nightlife', 'Sports', 'Arts', 'Entertainment', 'Health', 'Fitness', 'Social', 'Church', 'LGBTQ', 'Family', 'Tech', 'Black Owned'].map(category => {
                    const isSelected = subcategories.includes(category);
                    const isDisabled = !editEnabled || (!isSelected && subcategories.length >= 3);
                    return (
                      <button
                        key={category}
                        onClick={() => {
                          if (!editEnabled) return;
                          if (isSelected) {
                            setSubcategories(subcategories.filter(c => c !== category));
                          } else if (subcategories.length < 3) {
                            setSubcategories([...subcategories, category]);
                          }
                        }}
                        disabled={isDisabled}
                        style={{
                          padding: '10px 20px',
                          borderRadius: '20px',
                          border: isSelected ? '2px solid #00BCD4' : '2px solid #DDD',
                          background: isSelected ? '#00BCD4' : '#FFF',
                          color: isSelected ? '#FFF' : '#333',
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          opacity: isDisabled && !isSelected ? 0.4 : 1,
                          fontWeight: isSelected ? 'bold' : 'normal',
                          transition: 'all 0.2s'
                        }}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
                {subcategories.length > 0 && (
                  <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                    Selected: {subcategories.join(', ')}
                  </div>
                )}
                {subcategories.length >= 3 && (
                  <div style={{ marginTop: '5px', fontSize: '13px', color: '#FF6B6B', fontStyle: 'italic' }}>
                    Maximum 3 categories reached. Deselect one to choose another.
                  </div>
                )}
              </div>
              
              {/* Photo Gallery Section */}
              <div style={{ width: '100%', marginTop: '20px', marginBottom: '20px' }}>
                <div className={styles.title} style={{ marginBottom: '15px' }}>
                  Photo Gallery
                </div>
                
                {['gallery1', 'gallery2', 'gallery3', 'gallery4'].map((galleryId, idx) => (
                  <div key={galleryId} style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.5)', borderRadius: '10px' }}>
                    <div style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                      gap: '10px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <input
                          className={createMultipleClasses([
                            styles.input,
                            editEnabled ? '' : styles.disabled
                          ])}
                          type="text"
                          value={item[`photoGalleryLabel${idx + 1}`] || ''}
                          placeholder={`Gallery ${idx + 1} Label (e.g., "Team Photos", "Products")`}
                          disabled={!editEnabled}
                          onChange={(e) => handleItemChange(`photoGalleryLabel${idx + 1}`, e.target.value)}
                          style={{ fontSize: '14px', padding: '8px 12px' }}
                        />
                      </div>
                      {editEnabled && (
                        <label style={{ 
                          padding: '6px 14px',
                          background: '#F09925',
                          color: 'white',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '500',
                          whiteSpace: 'nowrap'
                        }}>
                          + Add Photos
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            style={{ display: 'none' }}
                            onChange={(e) => handlePhotoUpload(e, galleryId)}
                          />
                        </label>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', minHeight: photoGallery[galleryId]?.length === 0 ? '50px' : 'auto' }}>
                      {(!photoGallery[galleryId] || photoGallery[galleryId].length === 0) ? (
                        <div style={{ color: '#999', fontSize: '14px', fontStyle: 'italic' }}>
                          No photos uploaded yet
                        </div>
                      ) : (
                        photoGallery[galleryId].map((photo, index) => (
                          <div key={index} style={{ position: 'relative', width: '120px', height: '120px' }}>
                            <img 
                              src={photo.preview} 
                              alt={`Gallery ${idx + 1} ${index + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '2px solid #ddd' }}
                            />
                            {editEnabled && (
                              <button
                                onClick={() => removePhoto(galleryId, index)}
                                style={{
                                  position: 'absolute',
                                  top: '-8px',
                                  right: '-8px',
                                  background: '#ff4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '50%',
                                  width: '24px',
                                  height: '24px',
                                  cursor: 'pointer',
                                  fontSize: '16px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 'bold',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Menu Upload Section - DUPLICATED FROM PHOTOS */}
              <div style={{ width: '100%', marginTop: '20px', marginBottom: '80px' }}>
                <div className={styles.title} style={{ marginBottom: '15px' }}>
                  Menus
                </div>
                
                {[1, 2, 3, 4].map((menuNum) => (
                  <div key={menuNum} style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,255,255,0.5)', borderRadius: '10px' }}>
                    <div style={{ 
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '10px',
                      gap: '10px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <input
                          className={createMultipleClasses([
                            styles.input,
                            editEnabled ? '' : styles.disabled
                          ])}
                          type="text"
                          value={item[`menuLabel${menuNum}`] || ''}
                          placeholder={`Menu ${menuNum} Label (e.g., "Lunch Menu", "Drinks")`}
                          disabled={!editEnabled}
                          onChange={(e) => handleItemChange(`menuLabel${menuNum}`, e.target.value)}
                          style={{ fontSize: '14px', padding: '8px 12px' }}
                        />
                      </div>
                      {editEnabled && (
                        <label style={{ 
                          padding: '6px 14px',
                          background: '#F09925',
                          color: 'white',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '500',
                          whiteSpace: 'nowrap'
                        }}>
                          + Upload Menu
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => handleMenuUpload(e, menuNum)}
                          />
                        </label>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', minHeight: !item[`menuUrl${menuNum}`] ? '50px' : 'auto' }}>
                      {!item[`menuUrl${menuNum}`] ? (
                        <div style={{ color: '#999', fontSize: '14px', fontStyle: 'italic' }}>
                          No menu uploaded yet
                        </div>
                      ) : (
                        <div style={{ position: 'relative', width: '120px', height: '120px' }}>
                          <img 
                            src={item[`menuUrl${menuNum}`]} 
                            alt={`Menu ${menuNum}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', border: '2px solid #ddd' }}
                          />
                          {editEnabled && (
                            <button
                              onClick={() => handleItemChange(`menuUrl${menuNum}`, null)}
                              style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                background: '#ff4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      )}
                      </div>
                  </div>
                ))}
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
      </div>
    </div>
  );
};

export default MyBusiness;

