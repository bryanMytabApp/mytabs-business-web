import React from "react";
import bulletSelector from "../../assets/atoms/bulletSelector.svg";
import "./MTBInputValidator.css";

const MTBInputValidator = ({textRequirement, isValid}) => {
  const textStyle = isValid ? {color: "green"} : {};
  const iconClass = isValid ? "green-filter" : "";

  return (
    <div style={{display: "flex", flexDirection: "row", justifyContent: "flex-start"}}>
      <img src={bulletSelector} alt='bulletSelector' className={iconClass} />
      {"   "}
      <div className='input-validator-text-req' style={textStyle}>
        {textRequirement}
      </div>
    </div>
  );
};

export default MTBInputValidator;
