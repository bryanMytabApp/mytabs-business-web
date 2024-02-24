import React from "react";
import "./SubscriptionView.css";
import checkIcon from "../../assets/atoms/check.svg";
import {MTBButton} from "../../components";

const SubscriptionItem = ({isSelected, price, plan, benefits}) => {
  const bulletStyle = {
    backgroundColor: "teal",
    position: "relative",
    borderRadius: "25px",
    height: "20px",
    width: "20px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    flex: 1,
  };

  const spanLineStyle = {
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-start",
    position: "relative",
    gap: "10px"
  };
  return (
    <>
      {isSelected ? (
        <div className='selected-subscription-item'>
          <div className='subscription-item-header'>
            <span style={{flex: 1}}>Start free trial</span>
          </div>
          <div className='selected-subscription-block'>
            <div className='selected-subscription-item-title'>{plan}</div>

            <div className='selected-subscription-list'>
              {benefits.map((el, idx) => (
                <span key={idx} style={spanLineStyle}>
                  <div className='subscription-bullet' style={{  }}>
                    <img
                      style={{
                        // filter: "invert(0.4) sepia(0.5) saturate(5) hue-rotate(175deg)",
                      }}
                      src={checkIcon}
                      alt='checkmark'
                    />
                  </div>
                  <div style={{fontFamily: "Outfit"}}>{el}</div>
                </span>
              ))}
            </div>
            <MTBButton
              style={{
                borderRadius: "16px",
                width: "100%",
                flex: 1,
                backgroundColor: "#F18026",
                fontFamily: "Outfit",
                display: "inline",
                whiteSpace: "nowrap",
                justifySelf: "center",
              }}>
              Try Now
            </MTBButton>
          </div>
        </div>
      ) : (
        <div className='unselected-subscription-item'>
          <div className='unselected-subscription-item-title'>
            ${price}
            <span style={{color: "#929191", fontSize: "20px"}}>/month</span>
          </div>
          <div className='unselected-subscription-item-subtitle'>{plan}</div>
          <div className='unselected-subscription-list'>
            {benefits.map((el, idx) => (
              <span key={idx} style={spanLineStyle}>
                <div className='subscription-bullet' style={{backgroundColor: "#43A4C226", alignItems: "center", lineHeight: "20px"}}>
                  <img
                    style={{
                      filter: "invert(0.4) sepia(0.5) saturate(5) hue-rotate(175deg)",
                    }}
                    src={checkIcon}
                    alt='checkmark'
                  />
                </div>
                <div style={{fontFamily: "Outfit", color: "#929191", fontSize: "16px"}}>{el}</div>
              </span>
            ))}
            <MTBButton
              style={{
                borderRadius: "16px",
                width: "100%",
                flex: 1,
                backgroundColor: "#231D4F",
                fontFamily: "Outfit",
                display: "inline",
                whiteSpace: "nowrap",
                justifySelf: "center",
              }}>
              Purchase
            </MTBButton>
          </div>
        </div>
      )}
    </>
  );
};

export default SubscriptionItem;
