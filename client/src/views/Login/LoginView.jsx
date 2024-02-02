import React, {useState} from "react";
import {toast} from "react-toastify";
import {redirect, useNavigate} from "react-router-dom";
import logo from "../../assets/logo.png";
import {getCookie} from "../../utils/Tools.ts";
import "./LoginView.css";
import {MTBButton, MTBInput} from "../../components/";

export const LoaderLogin = () => {
  const isLoggedIn = getCookie("token") !== null;

  if (isLoggedIn) {
    return redirect("/admin");
  }

  return null;
};

const tempValid = {
  username: "manager",
  password: "Pass.word1!",
};
export default function LoginView() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invalid, setInvalid] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validatePassword = () => {
    return username === tempValid.username && password === tempValid.password;
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
      username: username.trim() ? undefined : "Please enter your email",
      password: password ? undefined : "Please enter your password",
    };

    if (_invalid.username || _invalid.password) {
      return setInvalid(_invalid);
    }

    setIsLoading(true);
    try {
      // await authService.login({ email: username.trim(), password: password });
      let res = validatePassword();
      if (!res) {
        toast.error( "invalid password" );
      } else {
        toast.success( "passwords agree." );
        navigate()
      }
      navigate("/admin/dashboards");
    } catch (error) {
      toast.error(error);
      setIsLoading(false);
    }
  };

  const handleSignUp = () => {
    navigate("/register")
  };
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  document.title = "My Tabs - Log In";

  return (
    <div className='Login-view'>
      <img style={{borderRadius: 20, overflow: "hidden"}} src={logo} alt='logo' />
      {/* <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: "35%",
        }}>
        <span>Log In</span>
      </div> */}
      <div className='Container-box'>
        <div className='Headers'>
          <div className="Sign-up-account-text">Don't have an account?<span className="Sign-up-underline" onClick={handleSignUp}>Sign up</span></div>
          <MTBButton style={{backgroundColor: "red"}} onClick={handleSignUp} isLoading={isLoading}>
            Sign Up
          </MTBButton>
        </div>
        <form
          className='Body'
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}>

          <div className="Account-details">Your account details</div>
          <MTBInput
            placeholder='Email or phone'
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
          <div className="Forgot-password">Forgot your password?</div>
        </form>

        <div className='Actions'></div>
        <div className='Footer'>
          By continuing, you agree in the Tabs terms and service and privacy notice.
          <MTBButton onClick={handleLogin} isLoading={isLoading}>
            Log In
          </MTBButton>
        </div>
      </div>
      <div class='welcome-back'>Welcome back!</div>
      <div class='log-in-to-your-account'>Log in to your account</div>
    </div>
  );
}
