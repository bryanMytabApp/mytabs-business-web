import React, {useState} from "react";
import "./MTBInput.css";
import warning from "../../assets/warning.svg";
import success from "../../assets/success.svg";
import info from "../../assets/info.svg";
import viewIcon from "../../assets/view.svg"
import hideIcon from "../../assets/view.svg";
const helperIcon = {
  warning: warning,
  success: success,
  info: info,
};

export default function  MTBInput  ({
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
}) {
  const [showPassword, setShowPassword] = useState(false);
  const classes = ["MTB-input", helper.type, children != null && "start"];
  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      return onEnterPress();
    }
  };

  return (
    <div className={classes.filter((c) => c).join(" ")}>
      {children}
      <div className="input-container" style={size === "small" ? { maxWidth: "3rem", ...style } : style}>
        <input
          name={name}
          placeholder={placeholder}
          autoComplete={autoComplete}
          type={type === 'password' && !showPassword ? 'password' : 'text'}
          disabled={disabled}
          value={value}
          onBlur={onBlur}
          onChange={(e) => (name ? onChange(e.target.value, name) : onChange(e.target.value))}
          onKeyDown={handleKeyDown}
        />
        {type === 'password' && (
          <img
            src={showPassword ? hideIcon : viewIcon}
            alt='Toggle visibility'
            className="view-icon"
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
