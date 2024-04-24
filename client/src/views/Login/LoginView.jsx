import React, {useState} from "react";
import {toast} from "react-toastify";
import {redirect, useNavigate} from "react-router-dom";
import logo from "../../assets/logo.png";
import {getCookie} from "../../utils/Tools.ts";
import "./LoginView.css";
import {MTBButton, MTBInput} from "../../components/";
import {getToken} from "../../services/authService";
import {getCustomerSubscription} from "../../services/paymentService";
import {parseJwt} from "../../utils/common";

export const LoaderLogin = () => {
  const isLoggedIn = getCookie("token") !== null;

  if (isLoggedIn) {
    let paymentData = {
      price: 13.99,
      plan: "Basic",
    };

    localStorage.setItem("checkoutResult", JSON.stringify(paymentData));

    return redirect("/admin");
  }

  return null;
};

export default function LoginView() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invalid, setInvalid] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const goToPasswordRecovery = () => {
    navigate("/password-recovery");
  };
  const handleUsername = (value) => {
    if (invalid.username) {
      setInvalid({...invalid, username: undefined});
    }
    setUsername(value);
  };

  const handlePassword = (value) => {
    if (invalid.password) {
      setInvalid({...invalid, password: undefined});
    }
    setPassword(value);
  };

  const handleLogin = async () => {
    if (isLoading) {
      return;
    }

    const _invalid = {
      username: username.trim() ? undefined : "Please enter your email or username",
      password: password ? undefined : "Please enter your password",
    };

    if (_invalid.username || _invalid.password) {
      return setInvalid(_invalid);
    }

    setIsLoading(true);
    try {
      let res = await getToken({username: username.trim(), password: password});

      localStorage.setItem("refToken", res.RefreshToken);
      localStorage.setItem("idToken", res.IdToken);
      toast.success("Welcome!");
      let userId = parseJwt(res.IdToken);

      let a = await getCustomerSubscription({userId});
      if (+a.data.currentPeriodEnd > new Date().getTime() / 1000) {
        navigate("/admin/dashboards");
      } else {
        navigate("/subscription");
      }
    } catch (error) {
      toast.error("Invalid user and/or password");
      console.error(error);
      setIsLoading(false);
    }
  };

  const handleSignUp = () => {
    navigate("/register");
  };
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

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
              <span class='agree-text-underline'>terms of service</span>
              <span class='agree-text'> </span>
              <span class='agree-text'>and </span>
              <span class='agree-text-underline'> privacy notice</span>
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
