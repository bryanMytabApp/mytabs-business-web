import React, {useState} from "react";
import {toast} from "react-toastify";
import {redirect, useNavigate} from "react-router-dom";
import logo from "../../assets/logo.png";
import {getCookie} from "../../utils/Tools.ts";
import "./LoginView.css";
import {MTBButton, MTBInput} from "../../components/";
// import IconButton from "@mui/material/IconButton";
// import VisibilityIcon from "@mui/icons-material/Visibility";
// import Visibility from "@mui/icons-material/Visibility";
// import VisibilityOff from "@mui/icons-material/VisibilityOff";
import viewIcon from "../../assets/view.svg";
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
        toast.error("invalid password");
      } else {
        toast.success("passwords agree.");
      }
      navigate("/admin/dashboards");
    } catch (error) {
      toast.error(error);
      setIsLoading(false);
    }
  };

  const handleSignUp = () => {};
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  document.title = "My Tabs - Log In";

  return (
    <div className='Login-view'>
      <div className='Container-box'>
        <img style={{borderRadius: 20}} src={logo} alt='logo' />
        <div className='Headers'>
          <span>Log In</span>
        </div>

        <form
          className='Body'
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin();
          }}>
          <MTBInput
            placeholder='Username'
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
        </form>

        <div className='Actions'>
          <MTBButton onClick={handleLogin} isLoading={isLoading}>
            Login
          </MTBButton>
          <MTBButton style={{backgroundColor: "red"}} onClick={handleSignUp} isLoading={isLoading}>
            Sign Up
          </MTBButton>
        </div>
      </div>
    </div>
  );
}
