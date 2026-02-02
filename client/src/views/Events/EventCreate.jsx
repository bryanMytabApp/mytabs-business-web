import React, { useEffect, useState, useRef } from "react";
import styles from './EventCreate.module.css'
import {
  IconButton,
  Divider,
  Modal,
  Box
} from '@mui/material/'
import {toast} from "react-toastify";
import { DemoContainer } from '@mui/x-date-pickers/internals/demo';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import moment from 'moment'
import { useNavigate } from "react-router-dom";
import selectIcon from "../../assets/atoms/selectIcon.svg";
import selectIconActive from "../../assets/atoms/selectIconActive.svg";
import tabsTicketsHeader from "../../assets/Tabs-tickets-header-hoz.png";
import { MTBDropZone, MTBSelector, TicketPreview } from "../../components";
import { State, City } from 'country-state-city';
import { createEvent, getPresignedUrlForEvent } from "../../services/eventService";
import { getBusiness } from "../../services/businessService";
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
  {
    value: 3,
    name: "Tabs Tickets",
  },
];

// Ticket type options based on ticketing method
const getTicketTypeOptions = (ticketOption) => {
  switch (ticketOption) {
    case 'Tabs Tickets':
    case 'Tickets with Tabs': // Backward compatibility
      return [
        'General Admission',
        'VIP',
        'Early Bird',
        'Student',
        'Senior',
        'Group',
        'Custom'
      ];
    case 'Free':
      return [
        'Free Entry',
        'RSVP Required',
        'First Come First Served',
        'Custom'
      ];
    case 'External link':
      return [
        'External Links',
        'Ticketmaster',
        'StubHub',
        'Facebook Events',
        'Custom'
      ];
    default:
      return ['Custom'];
  }
};

let userId
const countryCode = 'US';
const baseTicket = {
  option: 'Tabs Tickets',
  type: '',
  maxPerPurchase: 10,
  error: false
}

const baseTabsTicket = {
  option: 'Tabs Tickets',
  type: '',
  price: '',
  quantity: '4',
  maxPerPurchase: 10,
  description: '',
  error: false
}

const EventCreate = () => {
  const [selectedItem, setSelectedItem] = useState("")
  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])
  const [step, setStep] = useState(0)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [creationInProccess, setCreationInProccess] = useState(false)
  const [addressOption, setAddressOption] = useState(0)
  const [businessData, setBusinessData] = useState(null)
  const [tickets, setTickets] = useState([baseTicket])
  const [ticketSelectedIndex, setTicketSelectedIndex] = useState(0)
  const [draggedTicketIndex, setDraggedTicketIndex] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const [showTestModal, setShowTestModal] = useState(false)
  const [testPurchaseUrl, setTestPurchaseUrl] = useState('')

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
  
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  
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
    setCreationInProccess(true)
    let itemCopy = Object.assign({}, item)
    itemCopy.startDate = moment(itemCopy.startDate).toString()
    itemCopy.endDate = moment(itemCopy.endDate).toString()
    itemCopy.userId = userId
    itemCopy.tickets = tickets
    itemCopy.hasTickets = tickets && tickets.length > 0
    
    // Check if using Tabs ticketing system
    const hasTabsTickets = tickets.some(t => t.option === 'Tabs Tickets' || t.option === 'Tickets with Tabs')
    if (hasTabsTickets) {
      itemCopy.ticketType = 'tabs'
    }
    
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
      let res = await getPresignedUrlForEvent({
        id: data._id,
        userId
      })
      presignedUrl = res.data
    } catch (error) {
      toast.error("cannot create presigned url");
      console.error(error);
      handleGoBack()
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
    if(attr === 'description' && value.length >= 300) {
      setItem(prev => ({
        ...prev,
        [attr]: value.slice(0, 300),
        city: '',
      }))
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
    return addressOption === 1 && !item.address1
  }

  useEffect(() => {
    const token = localStorage.getItem("idToken");
    userId = parseJwt(token);
    let availableStates = State.getStatesOfCountry(countryCode);
    setStates(availableStates)
    
    // Fetch business data for tax calculation and address display
    const fetchBusinessData = async () => {
      try {
        console.log('🏢 Fetching business data for address and tax calculation...');
        const response = await getBusiness(userId);
        const data = response.data;
        setBusinessData(data);
        console.log('🏢 Business data loaded:', data);
        console.log('🏢 Business address details:', {
          address1: data.address1,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          hasCompleteAddress: !!(data.address1 && data.city && data.state && data.zipCode)
        });
        
        // Log if business address is incomplete
        if (!data.address1 || !data.city || !data.state || !data.zipCode) {
          console.warn('🏢 Business address is incomplete. Missing fields:', {
            address1: !data.address1,
            city: !data.city,
            state: !data.state,
            zipCode: !data.zipCode
          });
        }
      } catch (error) {
        console.error('🏢 Error fetching business data:', error);
        setBusinessData(null);
      }
    };
    
    fetchBusinessData();
  }, []);

  // Ensure tickets array is never empty
  useEffect(() => {
    if (!tickets || tickets.length === 0) {
      setTickets([baseTicket]);
      setTicketSelectedIndex(0);
    }
  }, [tickets]);

  useEffect(() => {
    if(!item.state) {
      return
    }
    let selectedState = states.find(state => state.name === item.state)
    let availableCities = City.getCitiesOfState(countryCode, selectedState.isoCode)
    setCities(availableCities)
  }, [item.state])

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!addressInputRef.current || !window.google) return;

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
  }, [addressOption]);

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
    // Clear field error when user starts typing
    clearFieldError(attr);
    
    // Add validation for description word limit (25 words max)
    if (attr === 'description') {
      const wordCount = value.trim().split(/\s+/).filter(word => word.length > 0).length;
      if (wordCount > 25) {
        toast.error("Ticket description cannot exceed 25 words");
        return;
      }
    }
    
    // Add validation for ticket option limits
    if (attr === 'option') {
      // Count existing tickets with specific options
      const externalLinkCount = tickets.filter(ticket => ticket.option === 'External link').length;
      const noTicketingCount = tickets.filter(ticket => ticket.option === 'Free').length;
      const currentTicketOption = tickets[ticketSelectedIndex]?.option;
      
      // Validation for External link - max 3 allowed
      if (value === 'External link') {
        // If current ticket is not already External link, check if we would exceed limit
        if (currentTicketOption !== 'External link' && externalLinkCount >= 3) {
          toast.error("Maximum of 3 External link tickets allowed per event");
          return;
        }
      }
      
      // Validation for No Ticketing (Free) - max 1 per 10 tickets allowed
      if (value === 'Free') {
        // If current ticket is not already Free, check if we would exceed limit
        if (currentTicketOption !== 'Free' && noTicketingCount >= 1) {
          toast.error("Only 1 No Ticketing option allowed per event");
          return;
        }
      }
    }

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

  // Helper functions to check ticket option limits
  const canAddExternalLink = () => {
    const externalLinkCount = tickets.filter(ticket => ticket.option === 'External link').length;
    const currentTicketOption = tickets[ticketSelectedIndex]?.option;
    return currentTicketOption === 'External link' || externalLinkCount < 3;
  };

  const canAddNoTicketing = () => {
    const noTicketingCount = tickets.filter(ticket => ticket.option === 'Free').length;
    const currentTicketOption = tickets[ticketSelectedIndex]?.option;
    return currentTicketOption === 'Free' || noTicketingCount < 1;
  };

  const getFieldErrorStyle = (fieldName) => {
    const hasError = fieldErrors[ticketSelectedIndex] && fieldErrors[ticketSelectedIndex][fieldName];
    return hasError ? { border: '2px solid #DC3545', borderRadius: '4px' } : {};
  };

  const getContainerErrorStyle = (fieldName) => {
    const hasError = fieldErrors[ticketSelectedIndex] && fieldErrors[ticketSelectedIndex][fieldName];
    return hasError ? { border: '2px solid #DC3545' } : {};
  };

  const clearFieldError = (fieldName) => {
    if (fieldErrors[ticketSelectedIndex] && fieldErrors[ticketSelectedIndex][fieldName]) {
      const newFieldErrors = { ...fieldErrors };
      delete newFieldErrors[ticketSelectedIndex][fieldName];
      if (Object.keys(newFieldErrors[ticketSelectedIndex]).length === 0) {
        delete newFieldErrors[ticketSelectedIndex];
      }
      setFieldErrors(newFieldErrors);
    }
  };

  const handleCloseTestModal = () => {
    setShowTestModal(false);
    setTestPurchaseUrl(''); // Clear the URL to stop iframe loading
  };

  const canAddMoreTickets = () => {
    if (tickets.length >= 10) return false;
    
    const firstTicketOption = tickets[0]?.option || 'Tabs Tickets';
    
    if (firstTicketOption === 'Free' && tickets.length >= 1) return false;
    if (firstTicketOption === 'External link' && tickets.length >= 5) return false;
    
    return true;
  };

  const getAddTicketMessage = () => {
    if (tickets.length >= 10) return 'Maximum 10 tickets reached';
    
    const firstTicketOption = tickets[0]?.option || 'Tabs Tickets';
    
    if (firstTicketOption === 'Free' && tickets.length >= 1) return 'Only 1 No Ticket option allowed';
    if (firstTicketOption === 'External link' && tickets.length >= 5) return 'Maximum 5 External Link tickets reached';
    
    return 'Add another ticketing option?';
  };

  const addNewTicket = () => {
    if (tickets.length >= 10) {
      toast.warning("Maximum of 10 tickets allowed per event");
      return;
    }
    
    // Use the same ticket type as the first ticket (set in Step 4)
    const firstTicketOption = tickets[0]?.option || 'Tabs Tickets';
    
    // Check specific limits for each ticket type
    if (firstTicketOption === 'Free' && tickets.length >= 1) {
      toast.warning("Only 1 No Ticket option allowed per event");
      return;
    }
    
    if (firstTicketOption === 'External link' && tickets.length >= 5) {
      toast.warning("Maximum of 5 External Link tickets allowed per event");
      return;
    }
    
    let newTicket;
    
    if (firstTicketOption === 'Tabs Tickets') {
      newTicket = Object.assign({}, baseTabsTicket);
    } else if (firstTicketOption === 'External link') {
      newTicket = Object.assign({}, baseTicket, { option: 'External link', type: 'External Links' });
    } else if (firstTicketOption === 'Free') {
      newTicket = Object.assign({}, baseTicket, { option: 'Free', type: 'Free Entry', subOption: 'No Cover Charge' });
    } else {
      newTicket = Object.assign({}, baseTicket, { option: firstTicketOption });
    }
    
    let ticketsCopy = JSON.parse(JSON.stringify(tickets))
    ticketsCopy.push(newTicket)
    
    setTickets(ticketsCopy)
    const newTicketIndex = ticketsCopy.length - 1;
    setTicketSelectedIndex(newTicketIndex)
    
    // Scroll to the newly added ticket after a short delay to ensure DOM is updated
    setTimeout(() => {
      const ticketElements = document.querySelectorAll(`.${styles['individual-ticket-container']}`);
      if (ticketElements[newTicketIndex]) {
        ticketElements[newTicketIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'start'
        });
      }
    }, 100);
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

  const validateTicketWithFieldErrors = (ticket = {}, ticketIndex) => {
    let error = false;
    let errors = {};
    
    if(ticket.option === 'External link') {
      if(!ticket.type) {
        errors.type = true;
        error = true;
      }
      if(!ticket.link1 && !ticket.link2 && !ticket.link3) {
        errors.link1 = true;
        error = true;
      }
    } else if(ticket.option === 'Tabs Tickets' || ticket.option === 'Tickets with Tabs') {
      if(!ticket.type) {
        errors.type = true;
        error = true;
      }
      if(!ticket.price) {
        errors.price = true;
        error = true;
      } else if(isNaN(ticket.price) || parseFloat(ticket.price) <= 0) {
        errors.price = true;
        error = true;
      }
      if(!ticket.quantity) {
        errors.quantity = true;
        error = true;
      } else if(isNaN(ticket.quantity) || parseInt(ticket.quantity) <= 0) {
        errors.quantity = true;
        error = true;
      }
    } else if(ticket.option === 'Free') {
      if(!ticket.type) {
        errors.type = true;
        error = true;
      }
    }
    
    return {
      ticket: { ...ticket, error },
      errors
    };
  };

  const validateTicket = (ticket = {}, index) => {
    let error = false
    if(ticket.option === 'External link') {
      if((!ticket.link1 && !ticket.link2 && !ticket.link3) || !ticket.type) {
        error = true
      }
    } else if(ticket.option === 'Tabs Tickets' || ticket.option === 'Tickets with Tabs') {
      if(!ticket.type || !ticket.price || !ticket.quantity) {
        error = true
      }
      // Validate price is a positive number
      if(ticket.price && (isNaN(ticket.price) || parseFloat(ticket.price) <= 0)) {
        error = true
      }
      // Validate quantity is a positive integer
      if(ticket.quantity && (isNaN(ticket.quantity) || parseInt(ticket.quantity) <= 0)) {
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
    let ticketsCopy = JSON.parse(JSON.stringify(tickets));
    let allFieldErrors = {};
    let hasErrors = false;
    
    ticketsCopy = ticketsCopy.map((ticket, index) => {
      const validation = validateTicketWithFieldErrors(ticket, index);
      if (Object.keys(validation.errors).length > 0) {
        allFieldErrors[index] = validation.errors;
        hasErrors = true;
      }
      return validation.ticket;
    });
    
    setTickets(ticketsCopy);
    setFieldErrors(allFieldErrors);
    
    if(hasErrors) {
      return false;
    }
    return true;
  }

  const handleTestPurchase = async (taxAmount = 0, taxBreakdown = []) => {
    console.log('🧪 handleTestPurchase called with tax:', { taxAmount, taxBreakdown });
    console.log('🧪 Current item:', item);
    console.log('🧪 Current tickets:', tickets);
    
    // If modal is already open, just update the data via postMessage without reloading
    if (showTestModal && testPurchaseUrl) {
      console.log('🧪 Modal already open, updating data via postMessage only');
      
      // Prepare updated event data
      const eventLocation = addressOption === 0 
        ? (businessData && businessData.address1 && businessData.city && businessData.state && businessData.zipCode
          ? {
              line1: businessData.address1,
              line2: businessData.address2 || undefined,
              city: businessData.city,
              state: businessData.state,
              postal_code: businessData.zipCode,
              country: 'US'
            }
          : undefined)
        : (item.address1 && item.city && item.state && item.zipCode
          ? {
              line1: item.address1,
              line2: item.address2 || undefined,
              city: item.city,
              state: item.state,
              postal_code: item.zipCode,
              country: 'US'
            }
          : undefined);

      const eventData = {
        id: 'test-preview', // Use consistent ID to avoid reload
        name: item.name,
        description: item.description || '',
        startDate: moment(item.startDate).toISOString(),
        endDate: moment(item.endDate).toISOString(),
        address1: item.address1 || '',
        address2: item.address2 || '',
        city: item.city || '',
        state: item.state || '',
        zipCode: item.zipCode || '',
        tickets: tickets,
        hasTickets: tickets && tickets.length > 0,
        ticketType: tickets.some(t => t.option === 'Tabs Tickets' || t.option === 'Tickets with Tabs') ? 'tabs' : 'other',
        imagePreview: uploadedImage || null,
        eventLocation: eventLocation,
        taxAmount: taxAmount,
        taxBreakdown: taxBreakdown,
        // ADD: Test mode flags for auto-fill functionality
        testMode: true,
        adminTest: true
      };

      // Send updated data to existing iframe
      const sendDataToIframe = () => {
        const iframe = document.getElementById('test-purchase-iframe');
        if (iframe && iframe.contentWindow) {
          console.log('🧪 Updating existing iframe with new data');
          iframe.contentWindow.postMessage({
            type: 'MYTABS_PREVIEW_DATA',
            eventData: eventData
          }, '*');
        }
      };

      // Send data immediately and with a small delay
      sendDataToIframe();
      setTimeout(sendDataToIframe, 100);
      return;
    }
    
    // Validate required fields before testing
    if (!item.name || !item.startDate || !item.endDate) {
      toast.error("Please complete event name, start date, and end date before testing");
      return;
    }

    if (!ticketsValidated()) {
      toast.error("Please fix ticket validation errors before testing");
      return;
    }

    try {
      console.log('🧪 Starting data preparation...');
      
      // Prepare event location for tax calculation
      let eventLocation = null;
      
      if (addressOption === 0) {
        // Use business address
        if (businessData) {
          eventLocation = {
            line1: businessData.address1 || '123 Main St',
            line2: businessData.address2 || null,
            city: businessData.city || 'Unknown City',
            state: businessData.state || 'TX',
            postal_code: businessData.zipCode || '00000',
            country: 'US'
          };
        } else {
          // Fallback to event address if business data not available
          eventLocation = {
            line1: item.address1 || '123 Main St',
            line2: item.address2 || null,
            city: item.city || 'Unknown City',
            state: item.state || 'TX',
            postal_code: item.zipCode || '00000',
            country: 'US'
          };
        }
      } else if (addressOption === 1) {
        // Use new event address
        eventLocation = {
          line1: item.address1 || '123 Main St',
          line2: item.address2 || null,
          city: item.city || 'Unknown City',
          state: item.state || 'TX',
          postal_code: item.zipCode || '00000',
          country: 'US'
        };
      }
      
      // Prepare event data for postMessage
      const eventData = {
        id: 'test-preview', // Use consistent ID to avoid reload
        name: item.name,
        description: item.description || '',
        startDate: moment(item.startDate).toISOString(),
        endDate: moment(item.endDate).toISOString(),
        address1: item.address1 || '',
        address2: item.address2 || '',
        city: item.city || '',
        state: item.state || '',
        zipCode: item.zipCode || '',
        tickets: tickets,
        hasTickets: tickets && tickets.length > 0,
        ticketType: tickets.some(t => t.option === 'Tabs Tickets' || t.option === 'Tickets with Tabs') ? 'tabs' : 'other',
        imagePreview: uploadedImage || null,
        eventLocation: eventLocation,
        taxAmount: taxAmount,
        taxBreakdown: taxBreakdown,
        // ADD: Test mode flags for auto-fill functionality
        testMode: true,
        adminTest: true
      };

      console.log('🧪 Event data prepared:', eventData);

      // Build URL with query parameters for test mode
      const urlParams = new URLSearchParams({
        test: 'true',
        admin: 'true',
        theme: 'light',
        lang: 'english',
        preview: 'true',
        waitForData: 'true',
        // Add event data directly to URL as backup
        eventId: 'test-preview', // Use consistent ID
        eventName: encodeURIComponent(item.name || 'Test Event'),
        previewMode: 'true'
      });

      // Add user token if available
      // 🚨 CRITICAL: Token passing logic - see ../PAYMENT_TOKEN_README.md before modifying
      // Get authentication token and add to URL for ticketing website
      const token = localStorage.getItem("idToken");
      if (token) {
        urlParams.set('userToken', token);
        console.log('🧪 Added user token');
      }

      // Use the ticketing URL for iframe
      const ticketUrl = `https://ticket.keeptabs.app/?${urlParams.toString()}#/preview`;
      
      console.log('🧪 Final URL for iframe:', ticketUrl);
      
      // Set the URL for iframe and show modal
      setTestPurchaseUrl(ticketUrl);
      setShowTestModal(true);
      
      toast.success("Opening ticketing preview...");
      
      // Send data to iframe multiple times to ensure it's received
      const sendDataToIframe = () => {
        const iframe = document.getElementById('test-purchase-iframe');
        if (iframe && iframe.contentWindow) {
          console.log('🧪 Sending data via postMessage to iframe');
          iframe.contentWindow.postMessage({
            type: 'MYTABS_PREVIEW_DATA',
            eventData: eventData
          }, 'https://ticket.keeptabs.app');
        }
      };
      
      // Send data multiple times with different delays
      setTimeout(sendDataToIframe, 1000);  // 1 second
      setTimeout(sendDataToIframe, 2000);  // 2 seconds  
      setTimeout(sendDataToIframe, 3000);  // 3 seconds
      setTimeout(sendDataToIframe, 5000);  // 5 seconds
      
    } catch (error) {
      console.error('❌ Error preparing test data:', error);
      console.error('❌ Error stack:', error.stack);
      toast.error(`Failed to prepare test data: ${error.message}`);
    }
  }

  // Drag and drop handlers for ticket reordering
  const handleDragStart = (e, index) => {
    setDraggedTicketIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
    e.target.classList.add(styles.dragging);
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove(styles.dragging);
    setDraggedTicketIndex(null);
    // Remove drag-over class from all elements
    document.querySelectorAll(`.${styles['individual-ticket-container']}`).forEach(el => {
      el.classList.remove(styles['drag-over']);
    });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    if (draggedTicketIndex !== null && draggedTicketIndex !== index) {
      e.target.closest(`.${styles['individual-ticket-container']}`).classList.add(styles['drag-over']);
    }
  };

  const handleDragLeave = (e) => {
    e.target.closest(`.${styles['individual-ticket-container']}`).classList.remove(styles['drag-over']);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedTicketIndex === null || draggedTicketIndex === dropIndex) {
      return;
    }

    const newTickets = [...tickets];
    const draggedTicket = newTickets[draggedTicketIndex];
    
    // Remove the dragged ticket from its original position
    newTickets.splice(draggedTicketIndex, 1);
    
    // Insert it at the new position
    newTickets.splice(dropIndex, 0, draggedTicket);
    
    setTickets(newTickets);
    
    // Update selected index if needed
    if (ticketSelectedIndex === draggedTicketIndex) {
      setTicketSelectedIndex(dropIndex);
    } else if (draggedTicketIndex < ticketSelectedIndex && dropIndex >= ticketSelectedIndex) {
      setTicketSelectedIndex(ticketSelectedIndex - 1);
    } else if (draggedTicketIndex > ticketSelectedIndex && dropIndex <= ticketSelectedIndex) {
      setTicketSelectedIndex(ticketSelectedIndex + 1);
    }
    
    setDraggedTicketIndex(null);
  };

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
              top: '10px',
              left: '10px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              zIndex: 10,
              background: 'rgba(255, 255, 255, 0.9)',
              padding: '5px 10px',
              borderRadius: '8px'
            }}
            onClick={() => setStep(prev => prev -1)}
          >
            <IconButton aria-label="delete" style={{ padding: '4px' }}>
              <ArrowBackIcon />
            </IconButton>
            <div style={{
              fontFamily: 'Outfit',
              fontSize: '15px',
              fontWeight: '500',
              lineHeight: '21.13px',
              textAlign: 'left',
              color: '#676565',
              marginLeft: '5px'
            }}>
              GO BACK
            </div>
          </div>
        )}
        {step === 5 && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              zIndex: 10,
              background: 'rgba(240, 153, 37, 0.9)',
              padding: '5px 10px',
              borderRadius: '8px'
            }}
            onClick={() => handleContinue(5, true)}
          >
            <div style={{
              fontFamily: 'Outfit',
              fontSize: '15px',
              fontWeight: '500',
              lineHeight: '21.13px',
              textAlign: 'right',
              color: 'white',
              marginRight: '5px'
            }}>
              NEXT
            </div>
            <IconButton 
              aria-label="next" 
              style={{ padding: '4px' }}
              disabled={creationInProccess}
            >
              <ArrowForwardIcon style={{ color: 'white' }} />
            </IconButton>
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
                  key={event.type}
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
              justifyContent: 'space-between',
              alignItems: 'center',
              flexDirection: 'column',
              width: '710px',
              height: '100%',
            }}
          >
            <div style={{
              width: '100%',
              overflowY: 'auto',
              flex: 1,
              paddingRight: '10px',
            }}>
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
                    placeholder="Description 300 characters"
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
                  style={{ width: '100%', display: 'flex', cursor: 'pointer', marginBottom: '15px' }}
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
                  style={{ width: '100%', display: 'flex', cursor: 'pointer', marginBottom: '15px' }}
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
                    {/* Google Places Autocomplete Input */}
                    <div className={styles.inputContainer} style={{ width: '100%', marginBottom: '15px' }}>
                      <input
                        ref={addressInputRef}
                        className={styles.input}
                        type="text"
                        placeholder="Start typing address..."
                        onBlur={() => {}}
                        onChange={() => {}} // Google Places handles the changes
                      />
                    </div>
                    
                    {/* Address Details Display (Read-only) - Horizontal Layout */}
                    {(item.address1 || item.city || item.state || item.zipCode) && (
                      <div style={{
                        backgroundColor: '#F8F9FA',
                        border: '1px solid #E9ECEF',
                        borderRadius: '10px',
                        padding: '15px',
                        marginBottom: '15px'
                      }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#495057',
                          marginBottom: '10px'
                        }}>
                          Address Details:
                        </div>
                        
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '15px',
                          alignItems: 'center'
                        }}>
                          {item.address1 && (
                            <div style={{
                              fontSize: '14px',
                              color: '#6C757D',
                              flex: '2 1 200px'
                            }}>
                              <strong>Street:</strong> {item.address1}
                            </div>
                          )}
                          
                          {item.city && (
                            <div style={{
                              fontSize: '14px',
                              color: '#6C757D',
                              flex: '1 1 120px'
                            }}>
                              <strong>City:</strong> {item.city}
                            </div>
                          )}
                          
                          {item.state && (
                            <div style={{
                              fontSize: '14px',
                              color: '#6C757D',
                              flex: '0 1 80px'
                            }}>
                              <strong>State:</strong> {item.state}
                            </div>
                          )}
                          
                          {item.zipCode && (
                            <div style={{
                              fontSize: '14px',
                              color: '#6C757D',
                              flex: '0 1 100px'
                            }}>
                              <strong>Zip:</strong> {item.zipCode}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Optional Address Line 2 - Keep this as manual input */}
                    <div className={styles.inputContainer} style={{ width: '100%', marginBottom: '10px' }}>
                      <input
                        className={styles.input}
                        type="text"
                        value={item.address2 || ''}
                        placeholder="Apt, Suite, Building (optional)"
                        onBlur={() => {}}
                        onChange={(e) => handleItemChange('address2',e.target.value)}
                      />
                    </div>
                  </span>              
                )}
              </div>
            </div>
            <button
              disabled={disabledButtonOnStepThree()}
              className={createMultipleClasses([styles.baseButton, styles.createEventButton, disabledButtonOnStepThree() ? styles.disabled : ''])}
              onClick={() => handleContinue(3)}
              style={{ marginTop: '20px', flexShrink: 0 }}
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
              height: 'auto',
              minHeight: '600px',
              padding: '40px 0',
            }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              maxWidth: '1000px',
            }}>
              <div className={styles.title} style={{ 
                marginBottom: '40px',
                textAlign: 'center',
                fontSize: '28px',
                fontWeight: '600',
                color: '#333'
              }}>
                What type of ticketing would you like to create?
              </div>
              
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                gap: '20px',
                width: '100%',
                maxWidth: '900px',
                marginBottom: '30px',
                justifyContent: 'center'
              }}>
                {/* Tickets with Tabs with Logo Option */}
                <div
                  onClick={() => {
                    setTickets([{...baseTabsTicket, option: 'Tabs Tickets'}]);
                    setTicketSelectedIndex(0);
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '20px',
                    border: tickets[0]?.option === 'Tabs Tickets' ? '3px solid #00AAD6' : '2px solid #E0E0E0',
                    borderRadius: '16px',
                    backgroundColor: tickets[0]?.option === 'Tabs Tickets' ? '#F0F9FF' : '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: tickets[0]?.option === 'Tabs Tickets' ? '0 4px 12px rgba(0, 170, 214, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
                    transform: tickets[0]?.option === 'Tabs Tickets' ? 'translateY(-2px)' : 'none',
                    width: '280px',
                    minHeight: '200px'
                  }}
                >
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: '2px solid #00AAD6',
                    backgroundColor: tickets[0]?.option === 'Tabs Tickets' ? '#00AAD6' : 'transparent',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {tickets[0]?.option === 'Tabs Tickets' && (
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'white'
                      }} />
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    flex: 1
                  }}>
                    <div style={{
                      width: '120px',
                      height: '80px',
                      backgroundColor: '#F0F9FF',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '16px',
                      backgroundImage: `url(${tabsTicketsHeader})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat'
                    }}>
                    </div>
                    <div>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#333',
                        marginBottom: '8px'
                      }}>
                        Tickets with Tabs
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#666',
                        lineHeight: '1.4'
                      }}>
                        Sell tickets through MyTabs platform with your branding
                      </div>
                    </div>
                  </div>
                </div>

                {/* External Links Option */}
                <div
                  onClick={() => {
                    setTickets([{...baseTicket, option: 'External link', type: 'External Links'}]);
                    setTicketSelectedIndex(0);
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '20px',
                    border: tickets[0]?.option === 'External link' ? '3px solid #00AAD6' : '2px solid #E0E0E0',
                    borderRadius: '16px',
                    backgroundColor: tickets[0]?.option === 'External link' ? '#F0F9FF' : '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: tickets[0]?.option === 'External link' ? '0 4px 12px rgba(0, 170, 214, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
                    transform: tickets[0]?.option === 'External link' ? 'translateY(-2px)' : 'none',
                    width: '280px',
                    minHeight: '200px'
                  }}
                >
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: '2px solid #00AAD6',
                    backgroundColor: tickets[0]?.option === 'External link' ? '#00AAD6' : 'transparent',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {tickets[0]?.option === 'External link' && (
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'white'
                      }} />
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    flex: 1
                  }}>
                    <div style={{
                      width: '120px',
                      height: '80px',
                      backgroundColor: '#F0F9FF',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #00AAD6',
                      marginBottom: '16px'
                    }}>
                      <span className="material-symbols-outlined" style={{ 
                        fontSize: '48px', 
                        color: '#00AAD6' 
                      }}>
                        open_in_new
                      </span>
                    </div>
                    <div>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#333',
                        marginBottom: '8px'
                      }}>
                        External Links
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#666',
                        lineHeight: '1.4'
                      }}>
                        Link to external ticketing platforms
                      </div>
                    </div>
                  </div>
                </div>

                {/* No Tickets Option */}
                <div
                  onClick={() => {
                    setTickets([{...baseTicket, option: 'Free', type: 'Free Entry', subOption: 'No Cover Charge'}]);
                    setTicketSelectedIndex(0);
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '20px',
                    border: tickets[0]?.option === 'Free' ? '3px solid #00AAD6' : '2px solid #E0E0E0',
                    borderRadius: '16px',
                    backgroundColor: tickets[0]?.option === 'Free' ? '#F0F9FF' : '#FFFFFF',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: tickets[0]?.option === 'Free' ? '0 4px 12px rgba(0, 170, 214, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
                    transform: tickets[0]?.option === 'Free' ? 'translateY(-2px)' : 'none',
                    width: '280px',
                    minHeight: '200px'
                  }}
                >
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: '2px solid #00AAD6',
                    backgroundColor: tickets[0]?.option === 'Free' ? '#00AAD6' : 'transparent',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {tickets[0]?.option === 'Free' && (
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'white'
                      }} />
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    flex: 1
                  }}>
                    <div style={{
                      width: '120px',
                      height: '80px',
                      backgroundColor: '#F0F9FF',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #00AAD6',
                      marginBottom: '16px'
                    }}>
                      <span className="material-symbols-outlined" style={{ 
                        fontSize: '48px', 
                        color: '#00AAD6' 
                      }}>
                        no_accounts
                      </span>
                    </div>
                    <div>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#333',
                        marginBottom: '8px'
                      }}>
                        No Tickets
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: '#666',
                        lineHeight: '1.4'
                      }}>
                        Entry to event with no ticketing required
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <button
                disabled={!tickets[0]?.option}
                className={createMultipleClasses([styles.baseButton, styles.createEventButton, !tickets[0]?.option ? styles.disabled : ''])}
                onClick={() => handleContinue(5, false)}
                style={{
                  width: '200px',
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '600'
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
        {step === 5 && tickets && tickets.length > 0 && tickets[ticketSelectedIndex] && (
          <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexDirection: 'column',
              width: '100%',
              height: 'auto',
              minHeight: '600px',
              padding: '20px 0',
              gap: '20px',
            }}
          >
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-start', 
              width: '100%', 
              height: 'auto',
              gap: '20px',
              alignItems: 'flex-start',
              flexWrap: 'wrap'
            }}>
              <span className={styles['tickets-viewer-container']} style={{ marginRight: '20px' }}>
                <div className={styles['ticket-list-container']}>
                  {tickets && tickets.length > 0 && tickets.map((ticket, index) => (
                    <div
                      key={index}
                      className={styles['individual-ticket-container']}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDragEnter={(e) => handleDragEnter(e, index)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
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
                        {/* Drag Handle */}
                        <div className={styles['drag-handle']}>
                          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                            drag_indicator
                          </span>
                        </div>
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
                              color: ticket.error ? 'red' : ticketSelectedIndex === index ? '#00AAD6' : '#514F4F',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '150px'
                            }}
                          >
                            {(ticket.type === 'Custom' && ticket.customName) ? ticket.customName : (ticket.type || `Ticket ${index <= 8 ? `0${index + 1}` : index + 1}`)}
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
                  className={createMultipleClasses([
                    styles['add-another-ticket-container'], 
                    !canAddMoreTickets() ? styles['disabled'] : styles['primary-color']
                  ])}
                  onClick={canAddMoreTickets() ? addNewTicket : undefined}
                  style={{
                    cursor: canAddMoreTickets() ? 'pointer' : 'not-allowed',
                    opacity: canAddMoreTickets() ? 1 : 0.5
                  }}
                >
                  <span className={styles['add-another-ticket-text']}>
                    {getAddTicketMessage()}
                  </span>
                  <span className="material-symbols-outlined">
                    {canAddMoreTickets() ? 'add' : 'block'}
                  </span>
                </div>
              </span>
              {tickets && tickets[ticketSelectedIndex] && (
              <span className={styles['middle-configuration-panel']}>
                <span>
                  {(tickets[ticketSelectedIndex]?.option === 'Free' || tickets[ticketSelectedIndex]?.option === 'External link' || tickets[ticketSelectedIndex]?.option === 'RSVP') && (
                    <div style={{ marginBottom: '10px', marginTop: '10px' }}>
                      <div className={styles['field-label']}>
                        Ticket Title
                      </div>
                    </div>
                  )}
                  {(tickets[ticketSelectedIndex]?.option === 'Free' || tickets[ticketSelectedIndex]?.option === 'External link' || tickets[ticketSelectedIndex]?.option === 'RSVP') && (
                  <div className={styles.inputContainer} style={getContainerErrorStyle('type')}>
                    <input
                      className={styles.input}
                      type="text"
                      value={tickets[ticketSelectedIndex]?.type || ''}
                      placeholder="Type your ‘Type of ticket’"
                      onBlur={() => {}}
                      onChange={(e) => changeTicketSelectedAttr('type', e.target.value)}
                    />
                  </div>
                  )}
                  {tickets[ticketSelectedIndex]?.option === 'External link' && (
                    <div className={styles['form-section']}>
                      <div className={styles['field-label']} style={{ marginBottom: '10px', marginTop: '10px' }}>
                        External link url
                      </div>
                      <div className={styles.inputContainer} style={{ marginBottom: '20px', ...getContainerErrorStyle('link1') }}>
                        <input
                          className={styles.input}
                          type="url"
                          value={tickets[ticketSelectedIndex].link1 || ''}
                          placeholder="https://example.com/tickets"
                          onBlur={() => {}}
                          onChange={(e) => changeTicketSelectedAttr('link1', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  {tickets[ticketSelectedIndex]?.option === 'Free' && (
                    <div className={styles['form-section']}>
                      <div className={styles['field-label']} style={{ marginBottom: '10px', marginTop: '10px' }}>
                        No Ticketing Type
                      </div>
                      <div className={styles.inputContainer} style={{ marginBottom: '15px' }}>
                        <select
                          className={styles.input}
                          value={tickets[ticketSelectedIndex].subOption || 'No Cover Charge'}
                          onChange={(e) => changeTicketSelectedAttr('subOption', e.target.value)}
                          style={{
                            appearance: 'none',
                            backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6,9 12,15 18,9\'%3e%3c/polyline%3e%3c/svg%3e")',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 12px center',
                            backgroundSize: '16px',
                            paddingRight: '40px'
                          }}
                        >
                          <option value="No Cover Charge">No Cover Charge</option>
                          <option value="Pay at Door">Pay at Door</option>
                        </select>
                      </div>
                      <div className={styles['field-label']} style={{ marginBottom: '10px', marginTop: '10px' }}>
                        Description Details
                      </div>
                      <div className={styles.inputContainer} style={{ marginBottom: '10px', ...getContainerErrorStyle('description') }}>
                        <textarea
                          className={styles.input}
                          style={{ height: '80px', resize: 'none' }}
                          value={tickets[ticketSelectedIndex].description || ''}
                          placeholder="Add details about entry requirements, what to expect, or any special instructions..."
                          onBlur={() => {}}
                          onChange={(e) => changeTicketSelectedAttr('description', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  {tickets[ticketSelectedIndex]?.option === 'Tabs Tickets' && (
                    <div className={styles['tabs-ticket-form']}>
                      
                      {/* 2x2 Grid for Form Fields */}
                      <div className={styles['form-grid']}>
                        {/* Row 1, Column 1: Ticket Title */}
                        <div className={styles['form-field']}>
                          <div className={styles['field-label']}>
                            Ticket Title
                          </div>
                          <div className={styles.inputContainer} style={getContainerErrorStyle('type')}>
                            <select
                              className={styles.input}
                              value={tickets[ticketSelectedIndex]?.type || ''}
                              onChange={(e) => changeTicketSelectedAttr('type', e.target.value)}
                              style={{ cursor: 'pointer' }}
                            >
                              <option value="">Select ticket type</option>
                              {getTicketTypeOptions(tickets[ticketSelectedIndex]?.option).map(option => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </div>
                          {/* Custom ticket name field - only show when Custom is selected */}
                          {tickets[ticketSelectedIndex]?.type === 'Custom' && (
                            <div style={{ marginTop: '10px' }}>
                              <div className={styles['field-label']}>
                                Custom Ticket Name
                              </div>
                              <div className={styles.inputContainer}>
                                <input
                                  className={styles.input}
                                  type="text"
                                  value={tickets[ticketSelectedIndex]?.customName || ''}
                                  placeholder="Enter custom ticket name"
                                  onBlur={() => {}}
                                  onChange={(e) => changeTicketSelectedAttr('customName', e.target.value)}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Row 1, Column 2: Price per ticket */}
                        <div className={styles['form-field']}>
                          <div className={styles['field-label']}>
                            Price per ticket (USD)
                          </div>
                          <div className={styles.inputContainer} style={getContainerErrorStyle('price')}>
                            <input
                              className={styles.input}
                              type="number"
                              step="0.01"
                              min="0"
                              value={tickets[ticketSelectedIndex].price || ''}
                              placeholder="25.00"
                              onBlur={() => {}}
                              onChange={(e) => changeTicketSelectedAttr('price', e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Row 2, Column 1: Quantity available */}
                        <div className={styles['form-field']}>
                          <div className={styles['field-label']}>
                            Quantity available
                          </div>
                          <div className={styles.inputContainer} style={getContainerErrorStyle('quantity')}>
                            <input
                              className={styles.input}
                              type="number"
                              min="1"
                              value={tickets[ticketSelectedIndex].quantity || ''}
                              placeholder="100"
                              onBlur={() => {}}
                              onChange={(e) => changeTicketSelectedAttr('quantity', e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Row 2, Column 2: Max per customer */}
                        <div className={styles['form-field']}>
                          <div className={styles['field-label']}>
                            Max per customer
                          </div>
                          <div className={styles.inputContainer}>
                            <input
                              className={styles.input}
                              type="number"
                              min="1"
                              value={tickets[ticketSelectedIndex].maxPerPurchase || 10}
                              placeholder="10"
                              onBlur={() => {}}
                              onChange={(e) => changeTicketSelectedAttr('maxPerPurchase', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Description - Full Width Below Grid */}
                      <div className={styles['description-field']}>
                        <div className={styles['field-label']}>
                          Ticket description (optional) - Max 25 words
                        </div>
                        <div className={styles.inputContainer} style={getContainerErrorStyle('description')}>
                          <textarea
                            className={styles.input}
                            style={{ height: '70px', resize: 'none', lineHeight: '1.5' }}
                            cols="20" rows="3"
                            value={tickets[ticketSelectedIndex].description || ''}
                            placeholder="e.g., Includes entry and one drink (max 25 words)"
                            onBlur={() => {}}
                            onChange={(e) => changeTicketSelectedAttr('description', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </span>
              </span>
              )}
              {/* Customer Preview Panel - Only show for Tabs Tickets */}
              {tickets[ticketSelectedIndex]?.option === 'Tabs Tickets' && (
                <TicketPreview 
                  ticket={tickets[ticketSelectedIndex]}
                  eventInfo={item}
                  addressOption={addressOption}
                  businessData={businessData}
                  onTestPurchase={(taxAmount = 0, taxBreakdown = []) => handleTestPurchase(taxAmount, taxBreakdown)}
                  showTestButton={true}
                  title="Customer Preview"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Test Purchase Modal */}
    <Modal
      open={showTestModal}
      onClose={handleCloseTestModal}
      aria-labelledby="test-purchase-modal"
      aria-describedby="test-purchase-preview"
    >
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '420px', // iPhone-like width
          height: '750px', // iPhone-like height
          bgcolor: '#1a1a1a', // Dark phone frame
          borderRadius: '25px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          p: '12px', // Phone frame padding
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Phone Frame Header (notch area) */}
        <div style={{
          height: '30px',
          backgroundColor: '#1a1a1a',
          borderRadius: '15px 15px 0 0',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative'
        }}>
          {/* Notch */}
          <div style={{
            width: '120px',
            height: '20px',
            backgroundColor: '#000',
            borderRadius: '10px',
            position: 'absolute'
          }} />
          
          {/* Close button */}
          <IconButton 
            onClick={handleCloseTestModal}
            style={{ 
              position: 'absolute',
              right: '5px',
              top: '2px',
              padding: '4px',
              color: '#fff',
              fontSize: '16px'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
          </IconButton>
        </div>

        {/* Phone Screen */}
        <div style={{
          flex: 1,
          backgroundColor: '#fff',
          borderRadius: '15px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          {/* Iframe Content */}
          <div style={{
            flex: 1,
            overflow: 'hidden'
          }}>
            {testPurchaseUrl && (
              <iframe
                id="test-purchase-iframe"
                src={testPurchaseUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  transform: 'scale(1)', // Mobile scale
                  transformOrigin: 'top left'
                }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
                onLoad={() => {
                  // Send data immediately when iframe loads
                  setTimeout(() => {
                    const iframe = document.getElementById('test-purchase-iframe');
                    if (iframe && iframe.contentWindow) {
                      console.log('🧪 Iframe loaded, sending data via postMessage');
                      iframe.contentWindow.postMessage({
                        type: 'MYTABS_PREVIEW_DATA',
                        eventData: {
                          id: 'test-' + Date.now(),
                          name: item.name,
                          description: item.description || '',
                          startDate: moment(item.startDate).toISOString(),
                          endDate: moment(item.endDate).toISOString(),
                          address1: item.address1 || '',
                          address2: item.address2 || '',
                          city: item.city || '',
                          state: item.state || '',
                          zipCode: item.zipCode || '',
                          tickets: tickets,
                          hasTickets: tickets && tickets.length > 0,
                          ticketType: tickets.some(t => t.option === 'Tabs Tickets' || t.option === 'Tickets with Tabs') ? 'tabs' : 'other',
                          imagePreview: uploadedImage || null
                        }
                      }, 'https://ticket.keeptabs.app');
                    }
                  }, 500);
                }}
              />
            )}
          </div>
        </div>

        {/* Phone Frame Bottom */}
        <div style={{
          height: '20px',
          backgroundColor: '#1a1a1a',
          borderRadius: '0 0 15px 15px'
        }} />
      </Box>
    </Modal>
  </div>
 )
};

export default EventCreate;

