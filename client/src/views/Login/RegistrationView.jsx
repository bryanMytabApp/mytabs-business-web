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

  useEffect(() => {
    if (myRef.current) {
      myRef.current.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [part]);
  let timeout;
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

  const styleInputDisabled = {
    opacity: "0.5",
    backgroundColor: "f0f0f0",
    borderColor: "black",
  };
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
    } catch (error) {
      let nameText = name.charAt(0).toUpperCase() + name.slice(1);
      if (error.enhancedMessage) {
        setErrors((prevErrors) => ({
          ...prevErrors,
          [name]: `${name == "phoneNumber" ? "Phone" : nameText} already exists.`,
        }));
      }
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
    if(name === 'zipCode' && (value.length > 5 || isNaN(value)) ) {
      return
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
        await getUserExistance({attribute: "email", value: encodeURIComponent(formData.email)});
      } catch (error) {
        errors.email = "Email already exists.";
      }
    }
    if (formData.username) {
      try {
        let res = await getUserExistance({attribute: "username", value: formData.username});
      } catch (error) {
        errors.username = "Username already exists.";
      }
    }
    if (formData.phoneNumber) {
      try {
        await getUserExistance({
          attribute: "phoneNumber",
          value: encodeURIComponent(`+1${formData.phoneNumber}`),
        });
      } catch (error) {
        errors.phoneNumber = "Phone already exists.";
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
      <div className='Container-box'>
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
              <table style={{gap: "20px"}}>
                <tr colspan='2'>
                  <td>
                    <MTBInput
                      style={{marginRight: "10px"}}
                      name='email'
                      placeholder='Email'
                      autoComplete='email'
                      value={formData.email}
                      onChange={handleInputChange}
                      helper={errors.email && {type: "warning", text: errors.email}}
                    />
                  </td>

                  <td>
                    <MTBInput
                      style={{marginLeft: "10px"}}
                      name='username'
                      placeholder='Username'
                      autoComplete='username'
                      value={formData.username}
                      onChange={handleInputChange}
                      helper={errors.username && {type: "warning", text: errors.username}}
                    />
                  </td>
                </tr>
              </table>

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
              <table>
                <tr colspan='2'>
                  <td>
                    <MTBInputValidator
                      textRequirement={"One uppercase letter"}
                      isValid={validationState.hasUppercase}
                    />
                  </td>
                  <td>
                    <MTBInputValidator
                      textRequirement={"One special character"}
                      isValid={validationState.hasSymbol}
                    />
                  </td>
                </tr>
                <tr colspan='2'>
                  <td>
                    <MTBInputValidator
                      textRequirement={"One number"}
                      isValid={validationState.hasNumber}
                    />
                  </td>
                  <td>
                    <MTBInputValidator
                      textRequirement={"11+ characters"}
                      isValid={validationState.hasAtLeastNumCharacters}
                    />
                  </td>
                </tr>
                <tr colspan='2'>
                  <td>
                    <MTBInputValidator
                      textRequirement={"One lowercase letter"}
                      isValid={validationState.hasLowercase}
                    />
                  </td>
                </tr>
              </table>
            </>
          )}
          {part === 1 && (
            <>
              <table>
                <tr colspan='2'>
                  <td>
                    <MTBInput
                      style={{marginRight: "10px"}}
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
                  </td>
                  <td>
                    <MTBInput
                      style={{marginLeft: "10px"}}
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
                  </td>
                </tr>
              </table>

              <div className='Account-details' style={{color: "black"}}>
                {secondHeaderText}
              </div>
              <div style={{ width: '100%' }}>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ width: '48%' }}>
                    {/* <div className={styles.title} style={{ marginBottom: 0 }}>
                      Location
                    </div> */}
                    <div style={{ width: '100%', margin: '7px 0 0 0' }}>
                      <MTBSelector
                        onBlur={() => ("state")}
                        name={"state"}
                        placeholder='State'
                        autoComplete='State'
                        value={formData.state}
                        itemName={"name"}
                        itemValue={"name"}
                        options={states}
                        onChange={(selected, fieldName) => {
                          handleInputChange(selected, 'state');
                        }}
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
                      value={formData.city}
                      itemName={"name"}
                      itemValue={"name"}
                      options={cities}
                      onChange={(selected, fieldName) => {
                        handleInputChange(selected, 'city');
                      }}
                      appearDisabled={!formData.state}
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
                    ])}
                    style={{ width: '48%' }}
                  >
                    <input
                      className={createMultipleClasses([
                        styles.input,
                      ])}
                      type="text"
                      value={formData.zipCode}
                      placeholder="Zip Code"
                      onBlur={() => {}}
                      onChange={(e) => handleInputChange(e.target.value, 'zipCode')}
                    />
                  </div>
                  <div
                    className={createMultipleClasses([
                      styles.inputContainer,
                    ])}
                    style={{ width: '48%' }}
                  >
                    <input
                      className={createMultipleClasses([
                        styles.input,
                      ])}
                      type="text"
                      value={formData.address1}
                      placeholder="Street"
                      onBlur={() => {}}
                      onChange={(e) => handleInputChange(e.target.value, 'address1')}
                    />
                  </div>
                </div>
              </div>
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
