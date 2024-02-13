import React, {useState} from "react";
import "./MTBSelector.css";
import chevronIcon from "../../assets/atoms/chevron.svg";

export default function MTBSelector({
  name,
  placeholder = "Select...",
  disabled = false,
  value,
  onChange,
  options = [],
  itemName = "name",
  itemValue = "value",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const displayValue =
    options.find((option) => option[itemValue] === value)?.[itemName] || placeholder;

  const handleOptionSelect = (val) => {
    onChange(val, name);
    setIsOpen(false);
  };

  return (
    <div className='mtb-selector-container' style={{position: "relative"}}>
      <div className='mtb-selector-value' onClick={() => setIsOpen(!isOpen)}>
        {displayValue}
        <div
          style={{
            width: "16px",
            height: "16px",
            transform: isOpen ? "rotate(180deg)" : null,
            flexShrink: 0,
          }}>
          <img src={chevronIcon} />
        </div>
      </div>
      {isOpen && (
        <div className='mtb-selector-options'>
          {options.map((option, index) => (
            <div
              key={index}
              className='mtb-selector-option'
              onClick={() => handleOptionSelect(option[itemValue])}>
              <div className='mtb-selector-square' style={{backgroundColor: option.color}}></div>
              {option[itemName]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
