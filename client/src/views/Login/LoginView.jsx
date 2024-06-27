import React from "react";
import logo from "../../assets/logo.png";
import "./LoginView.css";
import useLogin from "../../hooks/useLogin.js";
import {MTBButton, MTBInput} from "../../components/";

export default function LoginView() {
  const {
    username,
    password,
    invalid,
    isLoading,
    goToPasswordRecovery,
    handleUsername,
    handlePassword,
    handleLogin,
    handleSignUp } = useLogin();

  document.title = "My Tabs - Log In";

  return (
    <div className='Login-view'>
      <img
        style={{borderRadius: 20, top: "10%", left: "5%", position: "absolute"}}
        src={logo}
        alt='logo'
      />

      <div className='Container-box'>
        <div className='Headers'>
          <div className='Sign-up-account-text'>
            Don't have an account? &nbsp; &nbsp;
            <span className='Sign-up-underline' onClick={handleSignUp}>
              Sign up
            </span>
          </div>
        </div>
        <form
          className='Body'
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}>
          <div className='Account-details'>Sign in</div>
          <MTBInput
            placeholder='Email or username'
            autoComplete='username'
            value={username}
            disabled={isLoading}
            onChange={handleUsername}
            onEnterPress={handleLogin}
            helper={
              invalid.username && {
                type: "warning",
                text: invalid.username,
              }
            }
          />

          <MTBInput
            placeholder='Password'
            autoComplete='current-password'
            type='password'
            value={password}
            disabled={isLoading}
            onChange={handlePassword}
            onEnterPress={handleLogin}
            helper={
              invalid.password && {
                type: "warning",
                text: invalid.password,
              }
            }
          />
          <div onClick={goToPasswordRecovery} className='Forgot-password'>
            Forgot your password?
          </div>
        </form>

        <div className='Actions'></div>
        <div className='Footer'>
          <div
            style={{
              display: "flex",
              flex: 5,
              marginLeft: "10px",
              boxSizing: "border-box",
              alignItems: "center",
              paddingLeft: "20px",
            }}>
            <span>
              <span class='agree-text'>By continuing, you agree to My Tabs </span>
              <a href="https://www.mytabs.app/terms-comnditions" target="_blank" rel="noopener noreferrer">
                <span class='agree-text-underline'>terms of service</span>
              </a>
              <span class='agree-text'> </span>
              <span class='agree-text'>and </span>
              <a href="https://www.mytabs.app/privacy" target="_blank" rel="noopener noreferrer">
                <span class='agree-text-underline'> privacy notice</span>
              </a>
              <span class='agree-text'>.</span>
            </span>
          </div>
          <MTBButton
            style={{borderRadius: "16px", width: "10px", flex: 1}}
            onClick={handleLogin}
            isLoading={isLoading}>
            Log In
          </MTBButton>
        </div>
      </div>
      <div class='welcome-back'>Welcome back!</div>
      <div class='log-in-to-your-account'>Log in to your account</div>
    </div>
  );
}
