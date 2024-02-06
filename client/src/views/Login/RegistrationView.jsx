import React, {useState, useEffect} from "react";
import logo from "../../assets/logo.png";
import "./LoginView.css";
import {MTBButton, MTBInput} from "../../components";

export default function RegistrationView() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastNAme] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [city, setCity] = useState("");
  const [invalid, setInvalid] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [part, setPart] = useState(0);
  const firstHeaderText = ["Your account details", "Personal Info", "Business information"];
  const secondHeaderText = "Where are you located";

  const handleRegister = () => {
    setPart(part + 1);
  };
  //  const handleRegister = async () => {
  //    if (isLoading) {
  //      return;
  //    }

  //    const _invalid = {
  //      username: username.trim() ? undefined : "Please enter your email",
  //      password: password ? undefined : "Please enter your password",
  //    };

  //    if (_invalid.username || _invalid.password) {
  //      return setInvalid(_invalid);
  //    }

  //    setIsLoading(true);
  //    try {
  //      // await authService.login({ email: username.trim(), password: password });
  //      let res = validatePassword();
  //      if (!res) {
  //        toast.error("invalid password");
  //      } else {
  //        toast.success("passwords agree.");
  //        navigate();
  //      }
  //      navigate("/admin/dashboards");
  //    } catch (error) {
  //      toast.error(error);
  //      setIsLoading(false);
  //    }
  //  };
  const info = {
    uuid: "1a469f18-dfcc-49c7-90d4-4baf9fddcbca",
    email: "esaldana@bluepeople.com",
    password: "!123213",
    username: "mulder",
    firstName: "Eduardo",
    lastName: "Escamilla",
    phoneNumber: 12314123,
    address: "Rio Grande 142, Col Zapata ",
    zipcode: 78031,
    createdAt: "02/01/2024, 0:00:01AM",
    businessImage: require("../../assets/businessImage.png"),
    category: "music",
    status: true,
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
        <form className='Body'>
          <div className='Account-details' style={{color: "black"}}>
            {firstHeaderText[part]}
          </div>
          {part === 0 && (
            <>
              <div style={{display: "flex", flexDirection: "row", justifyContent: "space-between"}}>
                <MTBInput
                  style={{flex: 1}}
                  placeholder='Email or phone'
                  autoComplete='username'
                  value={username}
                  // disabled={isLoading}
                  // onChange={handleUsername}
                  // onEnterPress={handleLogin}
                  // helper={
                  //   invalid.username && {
                  //     type: "warning",
                  //     text: invalid.username,
                  //   }
                  // }
                />
                <MTBInput
                  style={{flex: 1}}
                  placeholder='Username'
                  autoComplete='username'
                  value={username}
                  // disabled={isLoading}
                  // onChange={handleUsername}
                  // onEnterPress={handleLogin}
                  // helper={
                  //   invalid.username && {
                  //     type: "warning",
                  //     text: invalid.username,
                  //   }
                  // }
                />
              </div>

              <MTBInput
                placeholder='Password'
                autoComplete='current-password'
                type='password'
                value={password}
                // disabled={isLoading}
                // onChange={handlePassword}
                // onEnterPress={handleLogin}
                // helper={
                //   invalid.password && {
                //     type: "warning",
                //     text: invalid.password,
                //   }
                // }
              />
              <MTBInput
                placeholder='Confirm Password'
                autoComplete='current-password'
                type='password'
                value={password}
                // disabled={isLoading}
                // onChange={handlePassword}
                // onEnterPress={handleLogin}
                // helper={
                //   invalid.password && {
                //     type: "warning",
                //     text: invalid.password,
                //   }
                // }
              />
            </>
          )}
          {part === 1 && (
            <>
              <MTBInput
                placeholder='First Name'
                autoComplete='firstname'
                value={firstName}
                // disabled={isLoading}
                // onChange={handleFirstName}
                // onEnterPress={handleRegister}
                helper={
                  invalid.firstName && {
                    type: "warning",
                    text: invalid.firstName,
                  }
                }
              />
              <MTBInput
                placeholder='Last Name'
                autoComplete='firstname'
                value={firstName}
                // disabled={isLoading}
                // onChange={handleFirstName}
                // onEnterPress={handleRegister}
                helper={
                  invalid.firstName && {
                    type: "warning",
                    text: invalid.firstName,
                  }
                }
              />

              <div className='Account-details' style={{color: "black"}}>
                {secondHeaderText}
              </div>

              <MTBInput
                placeholder='Zip code'
                autoComplete='firstname'
                value={firstName}
                // disabled={isLoading}
                // onChange={handleFirstName}
                // onEnterPress={handleRegister}
                helper={
                  invalid.firstName && {
                    type: "warning",
                    text: invalid.firstName,
                  }
                }
              />
              <MTBInput
                placeholder='City'
                autoComplete='firstname'
                value={firstName}
                // disabled={isLoading}
                // onChange={handleFirstName}
                // onEnterPress={handleRegister}
                helper={
                  invalid.firstName && {
                    type: "warning",
                    text: invalid.firstName,
                  }
                }
              />
            </>
          )}
          {part === 2 && (
            <>
              <MTBInput
                placeholder='First Name'
                autoComplete='firstname'
                value={firstName}
                // disabled={isLoading}
                // onChange={handleFirstName}
                // onEnterPress={handleRegister}
                helper={
                  invalid.firstName && {
                    type: "warning",
                    text: invalid.firstName,
                  }
                }
              />
              <MTBInput
                placeholder='Last Name'
                autoComplete='firstname'
                value={firstName}
                // disabled={isLoading}
                // onChange={handleFirstName}
                // onEnterPress={handleRegister}
                helper={
                  invalid.firstName && {
                    type: "warning",
                    text: invalid.firstName,
                  }
                }
              />

              <div className='Account-details' style={{color: "black"}}>
                {secondHeaderText}
              </div>

              <MTBInput
                placeholder='Zip code'
                autoComplete='firstname'
                value={firstName}
                // disabled={isLoading}
                // onChange={handleFirstName}
                // onEnterPress={handleRegister}
                helper={
                  invalid.firstName && {
                    type: "warning",
                    text: invalid.firstName,
                  }
                }
              />
              <MTBInput
                placeholder='City'
                autoComplete='firstname'
                value={firstName}
                // disabled={isLoading}
                // onChange={handleFirstName}
                // onEnterPress={handleRegister}
                helper={
                  invalid.firstName && {
                    type: "warning",
                    text: invalid.firstName,
                  }
                }
              />
            </>
          )}
        </form>

        <div className='Actions'></div>
        <div className='Footer'>
          <div style={{display: "flex", flex: 5}}></div>
          <MTBButton
            style={{borderRadius: "16px", width: "10px", flex: 1, backgroundColor: "#F18926"}}
            onClick={handleRegister}
            isLoading={false}>
            Continue
          </MTBButton>
        </div>
      </div>
      <div className='welcome-back'>Welcome!</div>
      <div className='log-in-to-your-account'>Lets create your first account in Tabs</div>
    </div>
  );
}
