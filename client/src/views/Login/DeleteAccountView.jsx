import React from "react";
import logo from "../../assets/logo.png";
import { useNavigate } from "react-router-dom";
import "./LoginView.css";
import { MTBButton, MTBInput } from "../../components";
import chevronIcon from "../../assets/atoms/chevron.svg";
import styles from "./DeleteAccountView.module.css";
import useDeleteAccount from "../../hooks/useDeleteAccount";


export default function DeleteAccountView() {
  const {
    errors,
    formData,
    isLoading,
    handleSubmit,
    handleInputChange
  } = useDeleteAccount();

  const navigate = useNavigate();

  return (
    <div className='Login-view'>
      <div className='rectangle'></div>
      <img
        className={'myTabsLogo'}
        src={logo}
        alt='logo'
      />
      <div className='Headers'>Registration</div>
      <div className='MainContent'>
        <div className='back-reg'>
          <div className='registration-back'>
            <img height="22" src={chevronIcon} alt='toggle' />
          </div>
          <div>Back</div>
        </div>
        <div className='already-have-an-account-log-in'>
          <span>
            <span className='already-have-an-account-log-in-span'>
              Already have an account?
            </span>
            <span
              className='already-have-an-account-log-in-span2'
              onClick={() => navigate("/login")}>
              Log in
            </span>
          </span>
        </div>
        <form className="formContainer">
          <div className={styles.deleteDisclaimer}>
            <h1>Delete Account</h1>
            <p>Are you sure you want to delete your account? This action will permanently remove all your user information, including profile pictures and any planned events you are attending. Once deleted, this information cannot be recovered.</p>
          </div>
          <MTBInput
            name='email'
            placeholder='Email'
            autoComplete='email'
            value={formData.email}
            onChange={(handleInputChange)}
            helper={errors.email && {type: "warning", text: errors.email}}
          />
          <MTBInput
            name='password'
            placeholder='Password'
            autoComplete='current-password'
            type='password'
            value={formData.password}
            onChange={handleInputChange}
            helper={errors.password && {type: "warning", text: errors.password}}
          />
          <MTBButton
            hasOwnClassName={true}
            onClick={handleSubmit}
            isLoading={isLoading}
            ownClassName={styles.button}
            >
            Confirm
          </MTBButton>
        </form>
      </div>
    </div>
  )
}