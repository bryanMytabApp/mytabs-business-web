import React from "react";
import bulletSelector from "../../assets/atoms/bulletSelector.svg";
import "./MTBInputValidator.css";

const MTBInputValidator = ({textRequirement}) => {
  return (
    <div style={{display: "flex", flexDirection: "row"}}>
      <img src={bulletSelector} alt='bulletSelector' />{" "}
      <div className='input-validator-text-req'>{textRequirement}</div>
    </div>
  );
};

export default MTBInputValidator;
