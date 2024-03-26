import React, {useState,useEffect} from "react";
import "./MTBInput.css";
import warning from "../../assets/warning.svg";
import success from "../../assets/success.svg";
import info from "../../assets/info.svg";
import viewIcon from "../../assets/view.svg";
import hideIcon from "../../assets/view.svg"; 

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
  options=[],
  pattern = "",
}) {
  const [ showPassword, setShowPassword ] = useState( false );
  const [filteredOptions, setFilteredOptions] = useState(options);
  const classes = ["MTB-input", helper.type, children != null && "start"];

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      onEnterPress();
    }
  };
  const getInputType = () => {
    if (type === "password") {
      return showPassword ? "text" : "password";
    }
    return type; 
  };

  return (
    <div className={type == "category" ? "MTB-category-input" : classes.filter(Boolean).join(" ")}>
      {children}
      <div
        className={type !== "category" ? "input-container" : "input-container-category"}
        style={size === "small" ? {maxWidth: "3rem", ...style} : style}>
        {type === "password" && (
          <img
            src={showPassword ? hideIcon : viewIcon}
            alt='Toggle visibility'
            className='view-icon'
            onClick={() => setShowPassword(!showPassword)}
          />
        )}
        <input
          name={name}
          placeholder={placeholder}
          autoComplete={autoComplete}
          type={getInputType()}
          disabled={disabled}
          value={value}
          onBlur={onBlur}
          onChange={(e) => onChange(e.target.value, name)}
          onKeyDown={handleKeyDown}
          pattern={pattern}
        />
      </div>
      {helper?.text && (
        <div className='Helper-text' style={{zIndex: 2}}>
          <img src={helperIcon[helper.type]} alt={helper.type} />
          <span>{helper.text}</span>
        </div>
      )}
    </div>
  );
}
