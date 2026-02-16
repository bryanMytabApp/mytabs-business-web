import React, {useState, useEffect, useCallback, useRef} from "react";
import logo from "../../assets/logo.png";
import "./LoginView.css";
import {
  MTBButton,
  MTBInput,
  MTBSelector,
  MTBInputValidator,
  MTBCategorySelector,
} from "../../components";
import MTBDropZone from "../../components/MTBDropZone/MTBDropZone";
import {toast} from "react-toastify";
import {useNavigate} from "react-router-dom";
import {signUp} from "../../services/authService";
import {parsePhoneNumberFromString} from "libphonenumber-js";
import chevronIcon from "../../assets/atoms/chevron.svg";
import {getUserExistance} from "../../services/userService";
import categoriesJS from "../../utils/data/categories";
import { getPresignedUrlForBusiness } from "../../services/businessService";
import { createMultipleClasses, parseJwt } from "../../utils/common";
import axios from "axios";
import { State, City } from 'country-state-city';
import styles from '../MyBusiness/MyBusiness.module.css';

let subCategoryList;
const countryCode = 'US';

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export default function RegistrationView() {
  const navigate = useNavigate();
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    zipCode: "",
    city: "",
    state: "",
    address1: "",
    subcategory: [],
    businessName: '',
    designation: '',
  });
  const [validationState, setValidationState] = useState({
    hasUppercase: false,
    hasSymbol: false,
    hasAtLeastNumCharacters: false,
    hasLowercase: false,
    hasNumber: false,
  });
  const [searchTerm, setSearchTerm] = useState("");

  const [filteredSubCategories, setFilteredSubCategories] = useState([]);

  const [inputTouched, setInputTouched] = useState({zipCode: false, city: false});
  const [imageFile, setImageFile] = useState();
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [part, setPart] = useState(0);
  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])
  
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const filterSubCategorySetter = () => {
    subCategoryList = categoriesJS;
    setFilteredSubCategories(categoriesJS);
  };
  const firstHeaderText = [
    "Create your account",
    "Personal Info",
    "Select three that best describe your business",
  ];
  const secondHeaderText = "Where are you located?";

  const cityList = [
    {value: 0, name: "Austin", color: "#fff"},
    {value: 1, name: "Dallas", color: "#fff"},
    {value: 2, name: "Houston", color: "#fff"},
    {value: 3, name: "Los Angeles", color: "#fff"},
    {value: 3, name: "New Orleans", color: "#fff"},
  ];

  const myRef = useRef(null);
  useEffect(() => {
    filterSubCategorySetter();
  }, [part]);

  useEffect(() => {
    let availableStates = State.getStatesOfCountry(countryCode);
    setStates(availableStates)
  }, []);

  useEffect(() => {
    if(!formData.state) {
      return
    }
    let selectedState = states.find(state => state.name === formData.state)
    let availableCities = City.getCitiesOfState(countryCode, selectedState.isoCode)
    setCities(availableCities)
  }, [formData.state])

  // Initialize Google Places Autocomplete for address input
  useEffect(() => {
    if (!addressInputRef.current || !window.google || part !== 1) return;

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

      setFormData(prev => ({
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
  }, [part]);

  useEffect(() => {
    if (myRef.current) {
      myRef.current.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [part]);
  useEffect(() => {
    let filtered;

    if (searchTerm.length) {
      filtered = JSON.parse(JSON.stringify(categoriesJS)).filter((subCategory) =>
        subCategory.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    } else {
      filtered = categoriesJS;
    }
    setFilteredSubCategories(filtered);
  }, [searchTerm]);

  const validatePassword = (password) => {
    let newState = {
      ...validationState,
      hasUppercase: /[A-Z]/.test(password),
      hasSymbol: /[@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?/!]+/.test(password),
      hasAtLeastNumCharacters: /.{11,}/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
    };

    setValidationState(newState);
  };

  useEffect(() => {
    validatePassword(formData.password);
  }, [formData.password]);

  const checkExistenceDebounced = debounce(async (name, value, setErrors) => {
    if (!value.trim()) return;
    if (name === "phoneNumber") {
      value = `1${value}`;
    }
    const encodeValue = encodeURIComponent(value);

    value = name === "username" ? encodeValue : value;
    try {
      const response = await getUserExistance({attribute: name, value});
      // If the API returns successfully with exists: true, show error
      if (response && response.exists) {
        let nameText = name.charAt(0).toUpperCase() + name.slice(1);
        setErrors((prevErrors) => ({
          ...prevErrors,
          [name]: `${name == "phoneNumber" ? "Phone" : nameText} already exists.`,
        }));
      } else {
        // Clear the error if user doesn't exist
        setErrors((prevErrors) => ({
          ...prevErrors,
          [name]: undefined,
        }));
      }
    } catch (error) {
      // Only show error if it's a specific "already exists" error from the API
      if (error.enhancedMessage && error.enhancedMessage.toLowerCase().includes('exist')) {
        let nameText = name.charAt(0).toUpperCase() + name.slice(1);
        setErrors((prevErrors) => ({
          ...prevErrors,
          [name]: `${name == "phoneNumber" ? "Phone" : nameText} already exists.`,
        }));
      }
      // Otherwise, silently fail (network errors, etc. shouldn't block registration)
    }
  }, 500);

  const handleSetUploadedImage = (image) => {
    setUploadedImage(image);

    setErrors((prevErrors) => {
      const updatedErrors = {...prevErrors};
      if (updatedErrors.uploadedImage) {
        delete updatedErrors.uploadedImage;
      }
      return updatedErrors;
    });
  };

  const handleCategoryChange = (selectedSubCategories) => {
    setFormData((prev) => ({
      ...prev,
      subcategory: selectedSubCategories,
    }));
  };

  const handleInputChange = useCallback((value, name) => {
    if(name === "username" || name === "email") {
      const noSpaceValue = value.replace(/\s+/g, '');
      value = noSpaceValue;
    }
    if (name === "zipCode" && (value.length > 5 || isNaN(value))) {
      return;
    }
    if ( name === "phoneNumber" ) {
      const cleanedValue = value.replace(/[^0-9]/g, "");
      if ( cleanedValue.length > 10 ) {
        return;
      }
      value = cleanedValue;
    }

    if (name === "state") {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        city: '',
      }))
      return
    }
    if (name === "subcategoryFilter") {
      setSubcategoryFilter(value);
      setSearchTerm(value);
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
    setSearchTerm(value);

    setErrors((prevErrors) => ({...prevErrors, [name]: undefined}));
    if (["email", "username", "phoneNumber"].includes(name)) {
      checkExistenceDebounced(name, value, setErrors);
    }
  }, []);

  const returnBack = () => {
    setPart((prevPart) => (prevPart > 0 ? prevPart - 1 : prevPart));
  };

  const handleBlur = (name) => {
    let error = errors["name"];
    if (name === "city" || name == "zipCode" || name == "uploadImage") error = "";
    setErrors((prevErrors) => ({...prevErrors, [name]: error}));
  };

  const validateForm = () => {
    let errors = {};
    if (part === 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!formData.email.trim() || !emailRegex.test(formData.email)) {
        errors.email = "Please enter a valid email address.";
      }

      if (!formData.username.trim()) {
        errors.username = "Username is required.";
      }

      if (!formData.password) {
        errors.password = "Password is required.";
      }

      if (!formData.phoneNumber) {
        errors.phoneNumber = "Phone number is required.";
      }

      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(formData.phoneNumber)) {
        errors.phoneNumber = "Phone number must be 10 digits.";
      }
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = "Passwords must match.";
      }
      if (!Object.values(validationState).every((value) => value === true)) {
        errors.password = "Password not secure enough.";
        errors.confirmPassword = "Password not secure enough.";
      }
    }
    if (part === 1) {
      if (!formData.firstName) {
        errors.firstName = "Please enter your first name.";
      }

      if (!formData.lastName) {
        errors.lastName = "Please enter your last name.";
      }

      if (!formData.zipCode.trim() && !formData.city.trim()) {
        errors.city = "Either Zip Code or City must be provided.";
      } else {
        if (formData.zipCode.trim() && !/^\d{5}$/.test(formData.zipCode)) {
          errors.zipCode = "Zip Code must be a 5-digit number.";
        }
      }
    }
    if (part === 2) {
      if (formData.subcategory.length === 0) {
        errors.subcategory = "Select three subcategories.";
      }
    }
    if (part === 3) {
      if (!uploadedImage) {
        errors.uploadedImage = "Upload a logo.";
      }
    }
    return errors;
  };

  const calculateCompletionPercentage = () => {
    let totalFields = Object.keys(formData).length - 1;
    let filledFields = Object.values(formData).reduce((acc, value, index, array) => {
      if (typeof value === "string") {
        if (value.trim() !== "") {
          acc++;
        }
      } else if (value !== undefined) {
        acc++;
      }
      return acc;
    }, 0);

    if (!formData.zipCode.trim() && !formData.city.trim()) {
      filledFields -= 1;
    }

    if (uploadedImage) {
      filledFields += 1;
    } else {
      totalFields += 1;
    }

    return (filledFields / totalFields) * 100;
  };
  const completionPercentage = calculateCompletionPercentage();

  const handleNextPart = async () => {
    let newErrors = validateForm();
    setErrors(newErrors);
    if (filteredSubCategories.length === 0) {
    }
    if (part === 0) {
      const asyncErrors = await validateUserExistence(formData);
      newErrors = {...newErrors, ...asyncErrors};
    }

    if (Object.keys(newErrors).length === 0 && part < 3) {
      setPart((prevPart) => prevPart + 1);
    } else {
      setErrors(newErrors);
      if (part === 0) {
        toast.error("Please correct the errors before proceeding.");
      }
      if (part === 2 && !uploadedImage) {
        toast.error("Upload a logo.");
      }
    }
  };

  const validateUserExistence = async (formData) => {
    const errors = {};

    if (formData.email) {
      try {
        const response = await getUserExistance({attribute: "email", value: encodeURIComponent(formData.email)});
        console.log("Email check response:", response);
        if (response && response.exists === true) {
          errors.email = "Email already exists.";
        }
      } catch (error) {
        console.error("Error checking email existence:", error);
        // Don't block registration if the API is down
      }
    }
    if (formData.username) {
      try {
        const response = await getUserExistance({attribute: "username", value: formData.username});
        console.log("Username check response:", response);
        if (response && response.exists === true) {
          errors.username = "Username already exists.";
        }
      } catch (error) {
        console.error("Error checking username existence:", error);
        // Don't block registration if the API is down
      }
    }
    if (formData.phoneNumber) {
      try {
        const response = await getUserExistance({
          attribute: "phoneNumber",
          value: encodeURIComponent(`+1${formData.phoneNumber}`),
        });
        console.log("Phone check response:", response);
        if (response && response.exists === true) {
          errors.phoneNumber = "Phone already exists.";
        }
      } catch (error) {
        console.error("Error checking phone existence:", error);
        // Don't block registration if the API is down
      }
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const phoneNumberInput = formData.phoneNumber;
    let phoneNumberWithPlus = `+1${formData.phoneNumber}`;
    const phoneNumber = parsePhoneNumberFromString(phoneNumberInput);

    let signUpPayload = {
      ...formData,
      phoneNumber: phoneNumberWithPlus,
      isAdmin: true,
    };
    let token
    try {
      const response = await signUp(signUpPayload);
      token = response.IdToken
      localStorage.setItem("idToken", response.IdToken);
      toast.success("Welcome!");
    } catch (error) {
      // Check if this is an account creation success but auto-login failure
      if (error.response && error.response.status === 201) {
        // Account was created successfully, but auto-login failed
        toast.success("Account created successfully! Please log in.");
        navigate("/login");
        return;
      }

      // Handle other errors
      let errorMessage = "An unexpected error occurred. Please try again.";

      if (error.enhancedMessage) {
        errorMessage = error.enhancedMessage;
      } else if (error.response && error.response.data) {
        errorMessage = error.response.data.message || errorMessage;
      }
      setPart(0);
      toast.error(errorMessage);
      return
    }
    let userId = parseJwt(token);
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
    navigate("/subscription");
  };
  

  const isFormFilled = () => {
    const requiredFieldsFilled = Object.values(formData).every((value) => {
      if (typeof value === "string") {
        return value.trim() !== "";
      }
      return value !== undefined;
    });
    const locationFilled = formData.zipCode.trim() !== "" || formData.city.trim() !== "";
    const imageUploaded = imageFile !== undefined;
    return requiredFieldsFilled && locationFilled && imageUploaded;
  };

  document.title = "My Tabs - Registration";

  return (
    <div className='Login-view' ref={myRef}>
      <div className='rectangle'></div>
      <img
        style={{borderRadius: 20, top: "10%", left: "5%", position: "absolute"}}
        src={logo}
        alt='logo'
      />
      <div className='Headers'>Registration</div>
      <div className='Container-box-responsive'>
        {part > 0 && (
          <div
            className='back-reg'
            style={{display: "flex", alignItems: "center", padding: "12px", fontStyle: "Outfit"}}>
            <div className='registration-back' onClick={returnBack}>
              <img style={{height: "22px"}} src={chevronIcon} alt='toggle' />
            </div>
            <div>Back</div>
          </div>
        )}
        <div className='already-have-an-account-log-in'>
          <span>
            <span className='already-have-an-account-log-in-span'>
              Already have an account?{"        "}{" "}
            </span>
            <span>{"   "}</span>
            <span
              className='already-have-an-account-log-in-span2'
              onClick={() => navigate("/login")}>
              Log in
            </span>
          </span>
        </div>
        <form className={part === 2 ? "Body-categories" : "Body"}>
          <div className='Account-details' style={{color: "black"}}>
            {firstHeaderText[part]}
          </div>
          {part === 0 && (
            <>
              <div style={{display: "flex", gap: "20px", width: "100%"}}>
                <div style={{flex: 1}}>
                  <MTBInput
                    name='email'
                    placeholder='Email'
                    autoComplete='email'
                    value={formData.email}
                    onChange={handleInputChange}
                    helper={errors.email && {type: "warning", text: errors.email}}
                  />
                </div>
                <div style={{flex: 1}}>
                  <MTBInput
                    name='username'
                    placeholder='Username'
                    autoComplete='username'
                    value={formData.username}
                    onChange={handleInputChange}
                    helper={errors.username ? {type: "warning", text: errors.username} : {type: "info", text: "One word, no spaces (e.g., johndoe123)"}}
                  />
                </div>
              </div>

              <MTBInput
                type='text'
                name='phoneNumber'
                placeholder='Phone'
                autoComplete='phone'
                value={formData.phoneNumber}
                onChange={handleInputChange}
                helper={errors.phoneNumber && {type: "warning", text: errors.phoneNumber}}
              />
              <MTBInput
                onBlur={() => handleBlur("password")}
                name='password'
                placeholder='Password'
                autoComplete='current-password'
                type='password'
                value={formData.password}
                onChange={handleInputChange}
                helper={errors.password && {type: "warning", text: errors.password}}
              />

              <MTBInput
                onBlur={() => handleBlur("confirmPassword")}
                name='confirmPassword'
                placeholder='Confirm Password'
                autoComplete='current-password'
                type='password'
                value={formData.confirmPassword}
                onChange={handleInputChange}
                helper={errors.confirmPassword && {type: "warning", text: errors.confirmPassword}}
              />
              <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px"}}>
                <MTBInputValidator
                  textRequirement={"One uppercase letter"}
                  isValid={validationState.hasUppercase}
                />
                <MTBInputValidator
                  textRequirement={"One special character"}
                  isValid={validationState.hasSymbol}
                />
                <MTBInputValidator
                  textRequirement={"One number"}
                  isValid={validationState.hasNumber}
                />
                <MTBInputValidator
                  textRequirement={"11+ characters"}
                  isValid={validationState.hasAtLeastNumCharacters}
                />
                <MTBInputValidator
                  textRequirement={"One lowercase letter"}
                  isValid={validationState.hasLowercase}
                />
              </div>
            </>
          )}
          {part === 1 && (
            <>
              <div style={{display: "flex", gap: "20px", width: "100%"}}>
                <div style={{flex: 1}}>
                  <MTBInput
                    onBlur={() => handleBlur("firstName")}
                    name='firstName'
                    placeholder='First Name'
                    autoComplete='given-name'
                    value={formData.firstName}
                    onChange={handleInputChange}
                    helper={
                      errors.firstName ? {type: "warning", text: errors.firstName} : undefined
                    }
                  />
                </div>
                <div style={{flex: 1}}>
                  <MTBInput
                    onBlur={() => handleBlur("lastName")}
                    name='lastName'
                    placeholder='Last Name'
                    autoComplete='lastName'
                    value={formData.lastName}
                    onChange={handleInputChange}
                    helper={
                      errors.lastName && {
                        type: "warning",
                        text: errors.lastName,
                      }
                    }
                  />
                </div>
              </div>

              <div className='Account-details' style={{color: "black"}}>
                {secondHeaderText}
              </div>
              
              {/* Google Places Autocomplete Input */}
              <div style={{ width: '100%', marginBottom: '15px' }}>
                <input
                  ref={addressInputRef}
                  className={createMultipleClasses([
                    styles.input,
                  ])}
                  type="text"
                  placeholder="Start typing address..."
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid #E0E0E0',
                    fontSize: '14px'
                  }}
                  onBlur={() => {}}
                  onChange={() => {}} // Google Places handles the changes
                />
              </div>
              
              {/* Address Details Display (Read-only) */}
              {(formData.address1 || formData.city || formData.state || formData.zipCode) && (
                <div style={{
                  backgroundColor: '#F8F9FA',
                  border: '1px solid #E9ECEF',
                  borderRadius: '10px',
                  padding: '15px',
                  marginBottom: '15px'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#495057' }}>
                    Selected Address:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '14px', color: '#6C757D' }}>
                    {formData.address1 && (
                      <div style={{ flex: '1 1 100%' }}>
                        <strong>Street:</strong> {formData.address1}
                      </div>
                    )}
                    {formData.city && (
                      <div style={{ flex: '1 1 45%' }}>
                        <strong>City:</strong> {formData.city}
                      </div>
                    )}
                    {formData.state && (
                      <div style={{ flex: '1 1 45%' }}>
                        <strong>State:</strong> {formData.state}
                      </div>
                    )}
                    {formData.zipCode && (
                      <div style={{ flex: '1 1 45%' }}>
                        <strong>Zip Code:</strong> {formData.zipCode}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ width: '48%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Business Name
                  </div>
                  <div
                    className={createMultipleClasses([
                      styles.inputContainer,
                    ])}
                    style={{ width: '100%' }}
                  >
                    <input
                      className={createMultipleClasses([
                        styles.input,
                      ])}
                      type="text"
                      value={formData.businessName}
                      placeholder="Business Name Field"
                      onBlur={() => {}}
                      onChange={(e) => handleInputChange(e.target.value, 'businessName')}
                    />
                  </div>
                </div>
                <div style={{ width: '48%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Designation
                  </div>
                  <div
                    className={createMultipleClasses([
                      styles.inputContainer,
                    ])}
                    style={{ width: '100%' }}
                  >
                    <input
                      className={createMultipleClasses([
                        styles.input,
                      ])}
                      type="text"
                      value={formData.designation}
                      placeholder="Designation"
                      onBlur={() => {}}
                      onChange={(e) => handleInputChange(e.target.value, 'designation')}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
          {part === 2 && (
            <>
              <MTBInput
                type='category'
                name={"subcategoryFilter"}
                placeholder='Type the category to filter options'
                autoComplete='subcategory'
                itemName={"name"}
                itemValue={"value"}
                value={subcategoryFilter}
                onChange={handleInputChange}
                options={filteredSubCategories}
                helper={
                  errors.subcategory
                    ? {
                        type: "warning",
                        text: errors.subcategory,
                      }
                    : Array.isArray(formData.subcategory) && formData.subcategory.length > 0
                    ? {
                        type: "info",
                        text: formData.subcategory
                          .map((el, idx) => `${idx + 1}. ${el.subcategories[0] || el.name}`)
                          .join(", "),
                        style: {color: "#00AAD6"},
                      }
                    : undefined
                }
              />

              <MTBCategorySelector
                onChange={handleCategoryChange}
                data={formData}
                filteredCategories={filteredSubCategories}
              />
            </>
          )}
          {part === 3 && (
            <MTBDropZone
              fileType={"image"}
              setFile={handleSetUploadedImage}
              uploadedImage={uploadedImage}
              helper={
                errors.uploadedImage ? {type: "warning", text: errors.uploadedImage} : undefined
              }
            />
          )}
        </form>
        <div
          className='progress-bar'
          style={{width: `${completionPercentage}%`, backgroundColor: "orange"}}></div>

        <div className='Actions'></div>

        <div className='Footer'>
          <div style={{display: "flex", flex: 5}}></div>

          {part === 0 && (
            <MTBButton
              style={{
                borderRadius: "16px",
                width: "10px",
                flex: 1,
                backgroundColor:
                  formData.email &&
                  formData.phoneNumber &&
                  formData.password &&
                  formData.confirmPassword
                    ? "#F18926"
                    : "#D9D9D9",
              }}
              onClick={handleNextPart}
              isLoading={isLoading}>
              Continue
            </MTBButton>
          )}
          {part === 1 && (
            <MTBButton
              style={{
                borderRadius: "16px",
                width: "10px",
                flex: 1,
                backgroundColor:
                  formData.firstName &&
                  formData.lastName &&
                  formData.city &&
                  formData.state &&
                  formData.address1 &&
                  formData.businessName &&
                  formData.designation &&
                  formData.zipCode
                    ? "#F18926"
                    : "#D9D9D9",
              }}
              disabled={
                !formData.firstName ||
                !formData.lastName ||
                !formData.city ||
                !formData.state ||
                !formData.address1 ||
                !formData.businessName ||
                !formData.designation ||
                !formData.zipCode
              }
              onClick={handleNextPart}
              isLoading={isLoading}>
              Continue
            </MTBButton>
          )}
          {part === 2 && (
            <MTBButton
              style={{
                borderRadius: "16px",
                width: "10px",
                flex: 1,
                backgroundColor:
                  formData.firstName &&
                  formData.lastName &&
                  (formData.city !== "" || formData.zipCode !== "")
                    ? "#F18926"
                    : "#D9D9D9",
              }}
              onClick={handleNextPart}
              isLoading={isLoading}>
              Continue
            </MTBButton>
          )}
          {part === 3 &&
            !(
              formData.email &&
              formData.phoneNumber &&
              formData.password &&
              formData.confirmPassword &&
              formData.firstName &&
              formData.lastName &&
              (formData.city !== "" || formData.zipCode !== "") &&
              formData.subcategory.length !== 0 &&
              !!uploadedImage
            ) && (
              <MTBButton
                style={{
                  borderRadius: "16px",
                  width: "10px",
                  flex: 1,
                  backgroundColor: formData.subcategory.length > 2 ? "#F18926" : "#D9D9D9",
                }}
                onClick={handleNextPart}
                isLoading={isLoading}>
                Continue
              </MTBButton>
            )}
          {part === 3 &&
            formData.email &&
            formData.phoneNumber &&
            formData.password &&
            formData.confirmPassword &&
            formData.firstName &&
            formData.lastName &&
            (formData.city !== "" || formData.zipCode !== "") &&
            formData.subcategory.length !== 0 &&
            !!uploadedImage && (
              <MTBButton onClick={handleSubmit} isLoading={isLoading}>
                Submit
              </MTBButton>
            )}
        </div>
      </div>
      <div className='welcome-back'>Welcome!</div>
      <div className='log-in-to-your-account'>Let's create your account</div>
    </div>
  );
}
