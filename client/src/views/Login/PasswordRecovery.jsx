import React, {useState, useEffect, useCallback, useRef} from "react";
import logo from "../../assets/logo.png";
import "./LoginView.css";
import {MTBButton, MTBInput } from "../../components";
import {toast} from "react-toastify";
import {useNavigate} from "react-router-dom";
import {requestResetPassword, confirmResetPassword} from "../../services/authService";
import chevronIcon from "../../assets/atoms/chevron.svg";
import styles from "./PasswordRecovery.module.css";
import { PasswordStrengthTable } from "../../components/PasswordStrengthTable";


export default function PasswordRecovery() {
  const createMultipleClasses = (classes = []) => classes.join(" ");
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    verificationCode: "",
  });
  const [validationState, setValidationState] = useState({
    hasUppercase: false,
    hasSymbol: false,
    hasAtLeastNumCharacters: false,
    hasLowercase: false,
    hasNumber: false,
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [part, setPart] = useState(0);

  const firstHeaderText = [
    "In order to change your password, we need to verify your identity. Enter the email address associated with your Tabs account.",
    "If your email address exists in our database, you will receive a code. Enter it below. Make sure to check Spam. ",
  ];

  const myRef = useRef(null);

  useEffect(() => {
    validatePassword(formData.password);
  }, [formData.password]);

  useEffect(() => {
    if (myRef.current) {
      myRef.current.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [part]);

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



  const handleInputChange = useCallback((value, name) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prevErrors) => ({...prevErrors, [name]: undefined}));

  }, []);

  const returnBack = () => {
    setPart((prevPart) => (prevPart > 0 ? prevPart - 1 : prevPart));
  };

  const handleBlur = (name) => {
    let error = errors["name"];
    if (name === "city" || name == "verificationCode" || name == "uploadImage") error = "";
    setErrors((prevErrors) => ({...prevErrors, [name]: error}));
  };

  const validateForm = () => {
    let errors = {};
    if (part === 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!formData.email.trim() || !emailRegex.test(formData.email)) {
        errors.email = "Please enter a valid email address.";
      }
    }
    if (part === 1) {
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = "Passwords must match.";
      }
      if (!Object.values(validationState).every((value) => value === true)) {
        errors.password = "Password not secure enough.";
        errors.confirmPassword = "Password not secure enough.";
      }

      if (formData.verificationCode.trim() && !/^\d{6}$/.test(formData.verificationCode)) {
        errors.verificationCode = "Verification code must be a 6-digit number.";
      }
    }

    return errors;
  };

  const calculateCompletionPercentage = () => {
    let totalFields = Object.keys(formData).length - 1;
    let filledFields = Object.values(formData).reduce((acc, value) => {
      if (typeof value === "string") {
        if (value.trim() !== "") {
          acc++;
        }
      } else if (value !== undefined) {
        acc++;
      }
      return acc;
    }, 0);

      totalFields += 1;

    return (filledFields / totalFields) * 100;
  };

  const completionPercentage = calculateCompletionPercentage();

  const handleNextPart = async () => {
    let newErrors = validateForm();
    setErrors(newErrors);

  
    if (Object.keys(newErrors).length === 0 && part < 3) {
      setPart((prevPart) => prevPart + 1);
    } else {
      setErrors(newErrors);
      if (part === 0) {
        toast.error("Please correct the errors before proceeding.");
      }
    }
  };

  const handleSendCode = async () => {
    try {
      await handleNextPart();
    } catch (error) {
      console.error("handleNextPart failed");
    }
    try {
      await requestResetPassword(formData);
    } catch (error) {
      console.error(error);
    }
  };

  const handleConfirmPassword = async () => {
    try {
      let res = await confirmResetPassword(formData);
      await handleNextPart();
    } catch (error) {
      setErrors((prevErrors) => ({
        ...prevErrors,
        verificationCode: "Verification code is incorrect.",
      }));
      toast.error("verification code is incorrect.");
      console.error(error);
    }
    try {
      
    } catch (error) {
      console.error("handleNextPart failed");
    }
  };

  const handleGoToLogin = async (e) => {
    navigate("/login");
  };


  document.title = "My Tabs - Password Recovery";

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
                </tr>
              </table>
            </>
          )}
          {part === 1 && (
            <>
              <MTBInput
                onBlur={() => {
                  handleBlur("verificationCode");
                }}
                type='number'
                name='verificationCode'
                placeholder='Verification Code'
                autoComplete='verificationCode'
                value={formData.verificationCode}
                onChange={handleInputChange}
                helper={
                  errors.verificationCode && {
                    type: "warning",
                    text: errors.verificationCode,
                  }
                }
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
              <PasswordStrengthTable validationState={validationState} />
            </>
          )}
          {part === 2 && (
            <>
              <div className={styles.successText}>
                <div>You've successfully</div>
                <div>changed your password</div>
              </div>
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
              hasOwnClassName={true}
              ownClassName={
                formData.email
                  ? createMultipleClasses([styles.button, styles.buttonActivated])
                  : styles.button
              }
              onClick={handleSendCode}
              isLoading={isLoading}>
              Send Code
            </MTBButton>
          )}
          {part === 1 && (
            <MTBButton
              hasOwnClassName={true}
              ownClassName={
                formData.email &&
                formData.verificationCode &&
                formData.password &&
                formData.confirmPassword
                  ? createMultipleClasses([styles.button, styles.buttonActivated])
                  : styles.button
              }
              onClick={handleConfirmPassword}
              isLoading={isLoading}>
              Change Password
            </MTBButton>
          )}

          {part === 2 &&
            formData.email &&
            formData.password &&
            formData.confirmPassword &&
            formData.verificationCode !== "" && (
              <MTBButton onClick={handleGoToLogin} isLoading={isLoading}>
                Go to Login
              </MTBButton>
            )}
        </div>
      </div>
      <div className={styles.leftMainText}>Password Recovery</div>
    </div>
  );
}
