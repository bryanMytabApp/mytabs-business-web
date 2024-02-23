import React from "react";
import "./SubscriptionView.css";
import checkIcon from "../../assets/atoms/check.svg";
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
                <span key={idx}>
                  <img src={checkIcon} alt='checkmark' /> {el}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className='unselected-subscription-item'>
          <div className='unselected-subscription-item-title'>${price}</div>
          <div className='unselected-subscription-item-subtitle'>{plan}</div>
          <div className='unselected-subscription-list'>
            {benefits.map((el, idx) => (
              <span key={idx} style={spanLineStyle}>
                <div style={bulletStyle}>
                  <img style={{}} src={checkIcon} alt='checkmark' />
                </div>
                <div style={{fontFamily:"Outfit"}}>{el}</div>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default SubscriptionItem;
