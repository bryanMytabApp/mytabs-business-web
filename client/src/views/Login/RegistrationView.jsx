import React, {useState, useEffect, useCallback} from "react";
import logo from "../../assets/logo.png";
import "./LoginView.css";
import {MTBButton, MTBInput, MTBSelector, MTBInputValidator} from "../../components";
import MTBDropZone from "../../components/MTBDropZone/MTBDropZone";
import {toast} from "react-toastify";
import {useNavigate} from "react-router-dom";
import {signUp} from "../../services/authService";
import {parsePhoneNumberFromString} from "libphonenumber-js";
import chevronIcon from "../../assets/atoms/chevron.svg";
import {getUserExistance} from "../../services/userService";

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
    category: "",
    subcategory: "",
  });
  const [validationState, setValidationState] = useState({
    hasUppercase: false,
    hasSymbol: false,
    hasAtLeastNumCharacters: false,
    hasLowercase: false,
    hasNumber: false,
  });
  const [inputTouched, setInputTouched] = useState({zipCode: false, city: false});
  const [imageFile, setImageFile] = useState();
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [part, setPart] = useState(0);
  const firstHeaderText = ["Create your account", "Personal Info", "Business information"];
  const secondHeaderText = "Where are you located";

  const cityList = [
    {value: 0, name: "Dallas", color: "#fff"},
    {value: 1, name: "Austin", color: "#fff"},
    {value: 2, name: "Houston", color: "#fff"},
    {value: 3, name: "Los Angeles", color: "#fff"},
  ];

  const categoryList = [
    {value: 0, name: "Music"},
    {value: 1, name: "Education"},
    {value: 2, name: "Night Life"},
    {value: 3, name: "Concert"},
  ];

  const subCategoryList = [
    {value: 0, name: "Restaurant"},
    {value: 1, name: "Hard rock"},
    {value: 2, name: "Soft Rock"},
    {value: 3, name: "Jazz"},
  ];

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
    console.log(errors);
  }, [formData]);

  useEffect(() => {
    validatePassword(formData.password);
  }, [formData.password]);

  const checkExistenceDebounced = debounce(async (name, value, setErrors) => {
    const plusSign = "%2B1";
    if (!value.trim()) return;
    if (name === "phoneNumber") {
      value = `1${value}`;
    }
    const encodeValue = encodeURIComponent(value);
    console.log("enocevalue", encodeValue);
    value = name === "username" ? encodeValue : value;
    try {
      const response = await getUserExistance({attribute: name, value});

      if (response.exists) {
        setErrors((prevErrors) => ({...prevErrors, [name]: `${name} already taken`}));
      }
    } catch (error) {
      console.error("Existence check failed:", error);
      console.error(error.enhancedMessage || "An unexpected error occurred.");

      if (error.enhancedMessage) {
        setErrors((prevErrors) => ({
          ...prevErrors,
          [name]: `${JSON.parse(error.enhancedMessage).error}`,
        }));
      }
    }
  }, 500);
  const handleInputChange = useCallback((value, name) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === "zipCode") {
      setInputTouched({
        zipCode: true,
        city: false,
      });
    }
    if (name === "city") {
      setInputTouched({
        zipCode: false,
        city: true,
      });
    }

    setErrors((prevErrors) => ({...prevErrors, [name]: undefined}));
    if (["email", "username", "phoneNumber"].includes(name)) {
      checkExistenceDebounced(name, value, setErrors);
    }
  }, []);

  const returnBack = () => {
    setPart((prevPart) => (prevPart > 0 ? prevPart - 1 : prevPart));
  };

  const handleBlur = (name) => {
    const error = errors["name"];
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
        errors.phoneNumber = "Phonenumber is required.";
      }

      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(formData.phoneNumber)) {
        errors.phoneNumber = "Phone number must be 10 digits.";
      }
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = "Passwords must match.";
      }
      if (!Object.values(validationState).every((value) => value === true)) {
        errors.password = "Password not secure enough";
        errors.confirmPassword = "Password not secure enough";
      }
    }
    if (part === 1) {
      if (!formData.firstName) {
        errors.firstName = "Please enter your first name";
      }

      if (!formData.zipCode && formData.city === "") {
        errors.city = "Enter a zip code or select a city";
      }
      const zipCodeRegex = /^\d{5}$/;
      if (!zipCodeRegex.test(formData.zipCode) && formData.zipCode) {
        errors.zipCode = "Please enter a valid 5-digit zip code.";
      }

      if (!formData.lastName) {
        errors.lastName = "Please enter your last name";
      }
    }
    if (part === 2) {
      if (formData.category === "") {
        errors.category = "Must have a category";
      }

      if (formData.subcategory === "") {
        errors.subcategory = "Select a subcategory";
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

    if (imageFile) {
      filledFields += 1;
    } else {
      totalFields += 1;
    }

    return (filledFields / totalFields) * 100;
  };
  const completionPercentage = calculateCompletionPercentage();

  const handleNextPart = () => {
    const newErrors = validateForm();
    setErrors(newErrors);

    (async () => {
      const asyncErrors = await validateUserExistence(formData);

      const combinedErrors = {...newErrors, ...asyncErrors};

      if (Object.keys(combinedErrors).length === 0) {
        if (part < 2) {
          setPart((prevPart) => prevPart + 1);
        }
      } else {
        setErrors(combinedErrors);

        toast.error("Please correct the errors before proceeding.");
      }
    })();
  };

  const validateUserExistence = async (formData) => {
    const errors = {};

    if (formData.email) {
      try {
        await getUserExistance({email: formData.email});
        errors.email = "Email already exists.";
      } catch (error) {}
    }
    if (formData.username) {
      try {
        await getUserExistance({username: formData.username});
        errors.username = "Username already exists.";
      } catch (error) {}
    }
    if (formData.phoneNumber) {
      try {
        await getUserExistance({phoneNumber: formData.phoneNumber});
        errors.phoneNumber = "Phone already exists.";
      } catch (error) {}
    }

    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const phoneNumberInput = formData.phoneNumber;
    let phoneNumberWithPlus = `+${formData.phoneNumber}`;
    const phoneNumber = parsePhoneNumberFromString(phoneNumberInput);

    let signUpPayload = {
      ...formData,
      phoneNumber: phoneNumberWithPlus,
      isAdmin: true,
    };

    try {
      const response = await signUp(signUpPayload);
      toast.success("Welcome!");
      navigate("/admin/dashboards");
    } catch (error) {
      let errorMessage = "An unexpected error occurred. Please try again.";

      if (error.enhancedMessage) {
        errorMessage = error.enhancedMessage;
      } else if (error.response && error.response.data) {
        errorMessage = error.response.data.message || errorMessage;
      }
      setPart(0);
      toast.error(errorMessage);
    }
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
    <div className='Login-view'>
      <div className='rectangle'></div>
      <img
        style={{borderRadius: 20, top: "10%", left: "5%", position: "absolute"}}
        src={logo}
        alt='logo'
      />
      <div className='Headers'>Registration</div>
      <div className='Container-box'>
        {part > 0 && (
          <div className='registration-back' onClick={returnBack}>
            <img src={chevronIcon} alt='toggle' />
          </div>
        )}
        <div className='already-have-an-account-log-in'>
          <span>
            <span class='already-have-an-account-log-in-span'>
              Already have an account?{"        "}{" "}
            </span>
            <span>{"   "}</span>
            <span class='already-have-an-account-log-in-span2' onClick={() => navigate("/login")}>
              Log in
            </span>
          </span>
        </div>
        <form className='Body'>
          <div className='Account-details' style={{color: "black"}}>
            {firstHeaderText[part]}
          </div>
          {part === 0 && (
            <>
              <table style={{gap: "20px"}}>
                <tr colspan='2'>
                  <td>
                    <MTBInput
                      onBlur={() => handleBlur("email")}
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
                      onBlur={() => handleBlur("username")}
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
                onBlur={() => handleBlur("phoneNumber")}
                type='number'
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

              <MTBInput
                onBlur={() => handleBlur("zipCode")}
                type='number'
                name='zipCode'
                placeholder='Zip code'
                autoComplete='zipCode'
                value={formData.zipCode}
                onChange={handleInputChange}
                helper={
                  errors.zipCode && {
                    type: "warning",
                    text: errors.zipCode,
                  }
                }
                className={inputTouched.city ? "input-appears-disabled" : ""}
                style={inputTouched.city ? styleInputDisabled : null}
              />
              <div className='or'>Or</div>
              <MTBSelector
                name={"city"}
                placeholder='City'
                autoComplete='city'
                value={formData.city}
                itemName={"name"}
                itemValue={"value"}
                options={cityList}
                onChange={(selected, fieldName) => {
                  handleInputChange(selected, fieldName);
                }}
                helper={
                  errors.city && {
                    type: "warning",
                    text: errors.city,
                  }
                }
                appearDisabled={inputTouched.zipCode}
              />
            </>
          )}
          {part === 2 && (
            <>
              <MTBSelector
                name={"category"}
                placeholder='Business category'
                autoComplete='category'
                itemName={"name"}
                itemValue={"value"}
                value={formData.category}
                onChange={handleInputChange}
                options={categoryList}
                helper={
                  errors.category && {
                    type: "warning",
                    text: errors.category,
                  }
                }
              />
              <MTBSelector
                name={"subcategory"}
                placeholder='Subcategory'
                autoComplete='subcategory'
                itemName={"name"}
                itemValue={"value"}
                value={formData.subcategory}
                onChange={handleInputChange}
                options={subCategoryList}
                helper={
                  errors.subcategory && {
                    type: "warning",
                    text: errors.subcategory,
                  }
                }
              />

              <MTBDropZone fileType={"image"} setFile={setImageFile}></MTBDropZone>
            </>
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
                  (formData.city !== "" || formData.zipCode !== "")
                    ? "#F18926"
                    : "#D9D9D9",
              }}
              onClick={handleNextPart}
              isLoading={isLoading}>
              Continue
            </MTBButton>
          )}
          {part == 2 &&
            !(
              formData.email &&
              formData.phoneNumber &&
              formData.password &&
              formData.confirmPassword &&
              formData.firstName &&
              formData.lastName &&
              (formData.city !== "" || formData.zipCode !== "") &&
              formData.category !== "" &&
              formData.subcategory !== "" &&
              !!imageFile
            ) && (
              <MTBButton
                style={{
                  borderRadius: "16px",
                  width: "10px",
                  flex: 1,
                  backgroundColor:
                    formData.category !== "" && formData.subcategory !== "" ? "#D9D9D9" : "#D9D9D9",
                }}
                onClick={handleNextPart}
                isLoading={isLoading}>
                Continue
              </MTBButton>
            )}
          {part === 2 &&
            formData.email &&
            formData.phoneNumber &&
            formData.password &&
            formData.confirmPassword &&
            formData.firstName &&
            formData.lastName &&
            (formData.city !== "" || formData.zipCode !== "") &&
            formData.category !== "" &&
            formData.subcategory !== "" &&
            !!imageFile && (
              <MTBButton onClick={handleSubmit} isLoading={isLoading}>
                Submit
              </MTBButton>
            )}
        </div>
      </div>
      <div className='welcome-back'>Welcome!</div>
      <div className='log-in-to-your-account'>Let's create your account</div>
      <div class='log-in-to-your-account-subtext'>
        We’re here to guide you every step of the way
      </div>
    </div>
  );
}
