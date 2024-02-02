import React from "react"
import logo from '../../assets/logo.png'
import './LoginView.css'
import { MTBButton } from "../../components";

export default function RegistrationView () {
  const info = {
    "uuid": "1a469f18-dfcc-49c7-90d4-4baf9fddcbca",
    "email": "esaldana@bluepeople.com",
    "password": "!123213",
    "username": "mulder",
    "firstName": "Eduardo",
    "lastName": "Escamilla",
    "phoneNumber": 12314123,
    "address": "Rio Grande 142, Col Zapata ",
    "zipcode": 78031,
    "createdAt": "02/01/2024, 0:00:01AM",
    "businessImage": require( '../../assets/businessImage.png' ),
    "category": "music",
    "status": true
  }
 document.title = "My Tabs - Registration";
  return (
    <div className='Login-view'>
      <img
        style={{borderRadius: 20, top: "10%", left: "5%", position: "absolute"}}
        src={logo}
        alt='logo'
      />
      <div className='Headers'>Registration</div>
      <div className='Container-box'></div>
      <div className='Actions'></div>
      <div className='Footer'>
        <div style={{display: "flex", flex: 5}}></div>
        <MTBButton
          style={{borderRadius: "16px", width: "10px", flex: 1, backgroundColor: "#F18926"}}
          //  onClick={handleHome}
          isLoading={false}>
          Continue
        </MTBButton>
      </div>
      <div class='welcome-back'>Welcome back!</div>
      <div class='log-in-to-your-account'>Lets create your first account in Tabs</div>
    </div>
  );
}

