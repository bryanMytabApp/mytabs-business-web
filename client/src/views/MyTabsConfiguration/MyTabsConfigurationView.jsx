import styles from './MyTabsConfiguration.module.css';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { toast } from "react-toastify";
import { IconButton } from '@mui/material/'
import { getUserById, getUserExistance, updateUser } from "../../services/userService";
import { useNavigate } from "react-router-dom";
import { createMultipleClasses } from "../../utils/common"
import React, { useEffect, useState } from "react";

let userPayload
const MyTabsConfigurationView = () => {
  const [item, setItem] = useState({})
  const [prevItem, setPrevItem] = useState({})
  const [editEnabled, setEditEnabled] = useState(false)
  const [errors, setErrors] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    username: '',
  });

  const navigation = useNavigate();

  const handleGoBack = () => navigation("/admin/home")

  const parseJwt = (token) => {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
    return JSON.parse(jsonPayload)
  };
  
  const init = () => {
    getUserById(userPayload["custom:user_id"])
      .then(res => {
        let _item = res.data
        _item.phoneNumber = Number(_item.phoneNumber.replace('+1', ''))
        setItem(_item)
        setPrevItem(_item)
      })
      .catch(err => console.error(err))
  }

  useEffect(() => {
    const token = localStorage.getItem("idToken");
    userPayload = parseJwt(token)
    init()
  }, []);

  
  const handleItemChange = (attr, value) => {
    setErrors(prev => ({ ...prev, [attr]: '' }))
    if(attr === 'phoneNumber' && (value.length > 10 || isNaN(value)) && value.length > item.phoneNumber.length) {
      return
    }
    setItem(prev => ({
      ...prev,
      [attr]: value
    }))

    if(["email", "username", "phoneNumber"].includes(attr) && value === prevItem[attr]) {
      return
    }

    if (["email", "username", "phoneNumber"].includes(attr)) {
      checkExistenceDebounced(attr, value, setErrors);
    }
  }

  const _updateEvent = async () => {
    let itemCopy = Object.assign({}, item)
    itemCopy.phoneNumber = '+1' + itemCopy.phoneNumber
    if(validateInput()) {
      return
    }
    itemCopy = {
      ...itemCopy,
      cognitoId: userPayload['cognito:username']
    }
    try {
      await updateUser(itemCopy)
      setEditEnabled(false)
      toast.success('User updated successfully');
    } catch (error) {
      console.error(error)
    }
  }

  const handleClickEdit = () => {
    if(!editEnabled) {
      setEditEnabled(prev => !prev)
      return
    }
    _updateEvent()
  }

  const debounce = (func, wait) => {
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
  
  const checkExistenceDebounced = debounce(async (name, value) => {
    if (!value.trim()) return;
    if (name === "phoneNumber") {
      value = `+1${value}`;
    }
    const encodeValue = encodeURIComponent(value);
  
    value = name === "username" ? encodeValue : value;
    try {
      await getUserExistance({attribute: name, value});
    } catch (error) {
      let nameText = name.charAt(0).toUpperCase() + name.slice(1);
      if (error.enhancedMessage) {
        setErrors((prevErrors) => ({
          ...prevErrors,
          [name]: `${name == "phoneNumber" ? "Phone" : nameText} already exists.`,
        }));
      }
    }
  }, 500);

  const validateInput = () => {
    let _errors = JSON.parse(JSON.stringify(errors))
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!item.email.trim() || !emailRegex.test(item.email)) {
      _errors.email = "Please enter a valid email address.";
    }

    if (!item.username.trim()) {
      _errors.username = "Username is required.";
    }

    if (!item.phoneNumber) {
      _errors.phoneNumber = "Phone number is required.";
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(item.phoneNumber)) {
      _errors.phoneNumber = "Phone number must be 10 digits.";
    }
    if (!item.firstName) {
      _errors.firstName = "Please enter your first name.";
    }

    if (!item.lastName) {
      _errors.lastName = "Please enter your last name.";
    }
    setErrors(_errors)
    return Object.values(_errors).some(err => !!err)
  }
  
 return (
    <div className={styles.view}>
      <div className={styles.contentContainer}>
        <div className={styles.titleContainer}>
          <IconButton aria-label="delete" onClick={handleGoBack}>
            <ArrowBackIcon />
          </IconButton>
          <h1>
            Settings
          </h1>
        </div>
        <div className={styles.tableContainer}>
          <div
            className={createMultipleClasses([
              styles['sub-content-container'],
              styles['right-container']
            ])}
          >
            <div style={{ width: '100%',padding: '0 10%', boxSizing: 'border-box' }}>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ width: '48%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    First Name
                  </div>
                  <div
                    className={createMultipleClasses([
                      styles.inputContainer,
                      editEnabled ? '' : styles.disabled,
                      errors.firstName ? styles.inputError : ''
                    ])}
                    style={{ width: '100%' }}
                  >
                    <input
                      className={createMultipleClasses([
                        styles.input,
                        editEnabled ? '' : styles.disabled
                      ])}
                      type="text"
                      value={item.firstName}
                      placeholder="First Name"
                      onBlur={() => {}}
                      disabled={!editEnabled}
                      onChange={(e) => handleItemChange('firstName',e.target.value)}
                    />
                  </div>
                  <div style={{ minHeight: 20, color: 'red' }}>
                    {errors.firstName}
                  </div>
                </div>
                <div style={{ width: '48%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Last Name
                  </div>
                  <div
                    className={createMultipleClasses([
                      styles.inputContainer,
                      editEnabled ? '' : styles.disabled,
                      errors.lastName ? styles.inputError : ''
                    ])}
                    style={{ width: '100%' }}
                  >
                    <input
                      className={createMultipleClasses([
                        styles.input,
                        editEnabled ? '' : styles.disabled
                      ])}
                      type="text"
                      value={item.lastName}
                      placeholder="Last Name"
                      onBlur={() => {}}
                      disabled={!editEnabled}
                      onChange={(e) => handleItemChange('lastName',e.target.value)}
                    />
                  </div>
                  <div style={{ minHeight: 20, color: 'red' }}>
                    {errors.lastName}
                  </div>
                </div>
              </div>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ width: '48%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Email Address
                  </div>
                  <div
                    className={createMultipleClasses([
                      styles.inputContainer,
                      editEnabled ? '' : styles.disabled,
                      errors.email ? styles.inputError : ''
                    ])}
                    style={{ width: '100%' }}
                  >
                    <input
                      className={createMultipleClasses([
                        styles.input,
                        editEnabled ? '' : styles.disabled,
                      ])}
                      type="text"
                      value={item.email}
                      placeholder="Email Address"
                      onBlur={() => {}}
                      disabled={!editEnabled}
                      onChange={(e) => handleItemChange('email',e.target.value)}
                    />
                  </div>
                  <div style={{ minHeight: 20, color: 'red' }}>
                    {errors.email}
                  </div>
                </div>
                <div style={{ width: '48%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Username
                  </div>
                  <div
                    className={createMultipleClasses([
                      styles.inputContainer,
                      editEnabled ? '' : styles.disabled,
                      errors.username ? styles.inputError : ''
                    ])}
                    style={{ width: '100%' }}
                  >
                    <input
                      className={createMultipleClasses([
                        styles.input,
                        editEnabled ? '' : styles.disabled
                      ])}
                      type="text"
                      value={item.username}
                      placeholder="Username"
                      onBlur={() => {}}
                      disabled={!editEnabled}
                      onChange={(e) => handleItemChange('username',e.target.value)}
                    />
                  </div>
                  <div style={{ minHeight: 20, color: 'red' }}>
                    {errors.username}
                  </div>
                </div>
              </div>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ width: '48%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Phone number
                  </div>
                  <div
                    className={createMultipleClasses([
                      styles.inputContainer,
                      editEnabled ? '' : styles.disabled,
                      errors.phoneNumber ? styles.inputError : ''
                    ])}
                    style={{ width: '100%' }}
                  >
                    <input
                      className={createMultipleClasses([
                        styles.input,
                        editEnabled ? '' : styles.disabled
                      ])}
                      type="text"
                      value={item.phoneNumber}
                      placeholder="Phone number"
                      onBlur={() => {}}
                      disabled={!editEnabled}
                      onChange={(e) => handleItemChange('phoneNumber',e.target.value)}
                    />
                  </div>
                  <div style={{ minHeight: 20, color: 'red' }}>
                    {errors.phoneNumber}
                  </div>
                </div>
                <div style={{ width: '48%' }}>
                  <div className={styles.title} style={{ marginBottom: 0 }}>
                    Password
                  </div>
                  <button
                    className={createMultipleClasses([
                      styles.baseButton,
                      styles['primary-background']
                    ])}
                    style={{ marginTop: '0px' }}
                    onClick={() => navigation('/password-recovery')}
                  >
                    Change Password
                  </button>
                </div>
              </div>
            </div>
          </div> 
          <button
            className={createMultipleClasses([
              styles.baseButton,
              styles.buttonAbsolute,
              styles['primary-background']
            ])}
            style={{ marginTop: '0px' }}
            onClick={handleClickEdit}
          >
            {editEnabled ? 'Save' : 'Edit'}
            <span class="material-symbols-outlined" style={{ fontSize: '17px', marginLeft: '5px' }}>
              {editEnabled ? 'save' : 'edit'}
            </span>
          </button>
        </div>
      </div>
    </div>
 )
};

export default MyTabsConfigurationView;