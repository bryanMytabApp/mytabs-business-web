import React, {useState, useRef, useEffect} from "react";
import "./MTBSelector.css";
import chevronIcon from "../../assets/atoms/chevron.svg";
import warning from "../../assets/warning.svg";
import success from "../../assets/success.svg";
import info from "../../assets/info.svg";

const helperIcon = {
  warning: warning,
  success: success,
  info: info,
};

export default function MTBSelector({
  name,
  placeholder = "Select...",
  disabled = false,
  value,
  onChange,
  options = [],
  itemName = "name",
  helper = {type: "", text: ""},
  styles = {},
  appearDisabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  console.log(helper)
  const displayValue =
    value && options.find((option) => option[itemName] === value)
      ? value 
      : placeholder;

  const handleOptionSelect = (index) => {
    const selectedOption = options[index];
    if (selectedOption) {
      onChange(selectedOption[itemName], name); 
    } else {
      onChange(null, name);
    }
    setIsOpen(false);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={ref} className='mtb-selector-container' style={{position: "relative"}}>
      <div
        className={appearDisabled ? "mtb-selector-value-disabled" : "mtb-selector-value"}
        onClick={() => setIsOpen(!isOpen)}
        style={{ ...styles}}
      >
        {displayValue}
        <div
          style={{
            width: "16px",
            height: "16px",
            transform: isOpen ? "rotate(180deg)" : null,
            flexShrink: 0,
          }}>
          <img src={chevronIcon} alt='toggle' />
        </div>
      </div>
      {isOpen && (
        <div className='mtb-selector-options'>
          {options.map((option, index) => (
            <div
              key={index}
              className='mtb-selector-option'
              onClick={() => handleOptionSelect(index)}>
              <div
                className='mtb-selector-square'
                style={{backgroundColor: option.color || "transparent"}}></div>
              {option[itemName]}
            </div>
          ))}
        </div>
      )}
      {!isOpen  && helper?.text && (
        <div className='Helper-text' style={{display: "block"}}>
          <img src={helperIcon[helper.type]} alt={helper.type} />
          <span>{helper.text}</span>
        </div>
      )}
    </div>
  );
}
