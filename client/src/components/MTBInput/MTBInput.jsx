import React, {useState} from "react";
import "./MTBInput.css";
import warning from "../../assets/warning.svg";
import success from "../../assets/success.svg";
import info from "../../assets/info.svg";
import viewIcon from "../../assets/view.svg";
import hideIcon from "../../assets/view.svg"; // Make sure this points to the correct icon for "hide"

const helperIcon = {
  warning: warning,
  success: success,
  info: info,
};

export default function MTBInput({
  name = null,
  placeholder = "",
  helper = {type: "", text: ""},
  disabled = false,
  type = "text",
  value = "",
  onChange = () => {},
  onBlur = () => {},
  onEnterPress = () => {},
  autoComplete = "",
  children = null,
  size = false,
  style = {},
  isWeb = false,
  pattern = "",
}) {
  const [showPassword, setShowPassword] = useState(false);
  const classes = ["MTB-input", helper.type, children != null && "start"];

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      onEnterPress();
    }
  };

  // Determine the correct input type based on the component's props and state
  const getInputType = () => {
    if (type === "password") {
      return showPassword ? "text" : "password";
    }
    return type; // For all other types, use the type as is
  };

  return (
    <div className={classes.filter(Boolean).join(" ")}>
      {children}
      <div
        className='input-container'
        style={size === "small" ? {maxWidth: "3rem", ...style} : style}>
        <input
          name={name}
          placeholder={placeholder}
          autoComplete={autoComplete}
          type={getInputType()} // Use the function to determine the input type
          disabled={disabled}
          value={value}
          onBlur={onBlur}
          onChange={(e) => onChange(e.target.value, name)}
          onKeyDown={handleKeyDown}
          pattern={pattern}
        />
        {type === "password" && (
          <img
            src={showPassword ? hideIcon : viewIcon}
            alt='Toggle visibility'
            className='view-icon'
            onClick={() => setShowPassword(!showPassword)}
          />
        )}
      </div>
      {helper?.text && (
        <div className='Helper-text'>
          <img src={helperIcon[helper.type]} alt={helper.type} />
          <span>{helper.text}</span>
        </div>
      )}
    </div>
  );
}
