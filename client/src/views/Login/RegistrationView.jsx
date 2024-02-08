import React, {useState, useEffect} from "react";
import logo from "../../assets/logo.png";
import "./LoginView.css";
import {MTBButton, MTBInput, MTBSelector, MTBInputValidator} from "../../components";
import MTBDropZone from "../../components/MTBDropZone/MTBDropZone";
import {toast} from "react-toastify";
import {useNavigate} from "react-router-dom";

export default function RegistrationView() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    zipcode: "",
    city: "",
    category: "",
    subcategory: "",
  });
  const [imageFile, setImageFile] = useState();
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [part, setPart] = useState(0);
  const firstHeaderText = ["Your account details", "Personal Info", "Business information"];
  const secondHeaderText = "Where are you located";
  const cityList = [
    {value: 0, name: "Dallas"},
    {value: 1, name: "Austin"},
    {value: 2, name: "Houston"},
    {value: 3, name: "Los Angeles"},
  ];
  const categoryList = [
    {value: 0, name: "music"},
    {value: 1, name: "Education"},
    {value: 2, name: "Night Life"},
    {value: 3, name: "Concert"},
  ];

  const subCategoryList = [
    {value: 0, name: "restaurant"},
    {value: 1, name: "hard rock"},
    {value: 2, name: "soft Rock"},
    {value: 3, name: "Jazz"},
  ];

  const handleInputChange = (value, name) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    let errors = {};

    if (!formData.username.trim()) {
      errors.username = "Username is required.";
    }

    if (!formData.password) {
      errors.password = "Password is required.";
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = "Passwords must match.";
    }

    return errors;
  };

  const handleNextPart = () => {
    const newErrors = validateForm();
    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0 && part < 2) {
      setPart(part + 1);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      toast.success("Congratulations!");
      navigate("/admin/dashboards");
    }
  };

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
        <div class='already-have-an-account-log-in'>
          <span>
            <span class='already-have-an-account-log-in-span'>Already have an account?</span>
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
              <div style={{display: "flex", flexDirection: "row", justifyContent: "space-between"}}>
                <MTBInput
                  name='email'
                  style={{flex: 1}}
                  placeholder='Email or phone'
                  autoComplete='email'
                  value={formData.email}
                  onChange={handleInputChange}
                  helper={errors.email && {type: "warning", text: errors.email}}
                />
                <MTBInput
                  name='username'
                  placeholder='Username'
                  autoComplete='username'
                  value={formData.username}
                  onChange={handleInputChange}
                  helper={errors.username && {type: "warning", text: errors.username}}
                />
              </div>

              <MTBInput
                name='password'
                placeholder='Password'
                autoComplete='current-password'
                type='password'
                value={formData.password}
                onChange={handleInputChange}
                helper={errors.password && {type: "warning", text: errors.password}}
              />
              <MTBInput
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
                      textRequirement={"Presence of at least one uppercase letter"}
                    />
                  </td>
                  <td>
                    <MTBInputValidator textRequirement={"Presence of at least one symbol"} />
                  </td>
                </tr>
                <tr colspan='2'>
                  <td>
                    <MTBInputValidator textRequirement={"Presence of at least one number"} />
                  </td>
                  <td>
                    <MTBInputValidator textRequirement={"Minimum number of 8 characters"} />
                  </td>
                </tr>
              </table>
            </>
          )}
          {part === 1 && (
            <>
              <MTBInput
                name='firstName'
                placeholder='First Name'
                autoComplete='given-name'
                value={formData.firstName}
                onChange={handleInputChange}
                helper={errors.firstName ? {type: "warning", text: errors.firstName} : undefined}
              />
              <MTBInput
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

              <div className='Account-details' style={{color: "black"}}>
                {secondHeaderText}
              </div>

              <MTBInput
                name='zipcode'
                placeholder='Zip code'
                autoComplete='zipcode'
                value={formData.zipcode}
                onChange={handleInputChange}
                helper={
                  errors.zipcode && {
                    type: "warning",
                    text: errors.zipcode,
                  }
                }
              />
              <MTBSelector
                name={"city"}
                placeholder='City'
                autoComplete='city'
                value={formData.city}
                itemName={"name"}
                itemValue={"value"}
                onChange={handleInputChange}
                options={cityList}
                helper={
                  errors.city && {
                    type: "warning",
                    text: errors.city,
                  }
                }
              />
            </>
          )}
          {part === 2 && (
            <>
              <MTBSelector
                name={"category"}
                placeholder='Type the catgory of your business'
                autoComplete='category'
                itemName={"name"}
                itemValue={"value"}
                value={formData.category}
                onChange={handleInputChange}
                options={categoryList}
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
              />

              <MTBDropZone fileType={"image"} setFile={setImageFile}></MTBDropZone>
            </>
          )}
        </form>

        <div className='Actions'></div>
        <div className='Footer'>
          <div style={{display: "flex", flex: 5}}></div>
          {part < 2 && (
            <MTBButton
              style={{borderRadius: "16px", width: "10px", flex: 1, backgroundColor: "#F18926"}}
              onClick={handleNextPart}
              isLoading={isLoading}>
              Continue
            </MTBButton>
          )}
          {part === 2 && (
            <MTBButton onClick={handleSubmit} isLoading={isLoading}>
              Submit
            </MTBButton>
          )}
        </div>
      </div>
      <div className='welcome-back'>Welcome!</div>
      <div className='log-in-to-your-account'>Lets create your first account in Tabs</div>
      <div class='log-in-to-your-account-subtext'>
        We’re here to guide you every step of the way
      </div>
    </div>
  );
}
