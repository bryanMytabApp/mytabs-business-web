import React, {useState, useEffect} from "react";
import "./MTBSelector.css";

export default function MTBSelector({
  name = null,
  placeholder = "",
  disabled = false,
  value = "",
  onChange = () => {},
  size = false,
  style = {},
  options = [],
  itemName = null,
  itemValue = null,
  multi = false,
}) {
  const [selectedOptions, setSelectedOptions] = useState([]);
  useEffect(() => {
    if (multi && selectedOptions) {
      name ? onChange(selectedOptions, name) : onChange(selectedOptions);
    }
  }, [selectedOptions]);

  useEffect(() => {
    if (multi && value.length > 0) setSelectedOptions(value);
  }, [value]);

  const handleOptionClick = (option) => {
    if (selectedOptions.includes(option)) {
      setSelectedOptions(selectedOptions.filter((item) => item !== option));
    } else {
      setSelectedOptions([...selectedOptions, option]);
    }
  };

  return (
    <div className='MTB-select' style={size === "small" ? {maxWidth: "6rem"} : {}}>
      {multi && (
        <div style={{margin: 16}}>
           Selected Options :
          <div>
            {selectedOptions.map((option, index) => (
              <span key={index}>
                {index > 0 && ","} {itemName ? option[itemName] : option.value}
              </span>
            ))}
          </div>
        </div>
      )}
      <select
        multiple={multi}
        name={name}
        placeholder={placeholder}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          if (!multi) {
            name ? onChange(e.target.value, name) : onChange(e.target.value);
          }
        }}
        style={style}>
        <option disabled={true} value=''>
          {placeholder}
        </option>
        {!options ? (
          <></>
        ) : (
          options.map((item) => (
            <>
              <option
                value={itemValue ? item[itemValue] : item.value}
                onClick={multi ? () => handleOptionClick(item) : null}
                selected={multi ? selectedOptions.includes(item) : null}>
                {itemName ? item[itemName] : item.value}
              </option>
            </>
          ))
        )}
      </select>
    </div>
  );
}
