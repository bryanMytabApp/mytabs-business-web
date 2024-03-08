import React from "react";
import "./SubscriptionView.css";
import checkIcon from "../../assets/atoms/check.svg";
import {MTBButton} from "../../components";
import {useNavigate} from "react-router-dom";

const SubscriptionItem = ({isSelected, price, plan, benefits, onClick, bottomText}) => {
  const navigation = useNavigate();
  const spanLineStyle = {
    display: "flex",
    flexDirection: "row",
    justifyContent: "flex-start",
    position: "relative",
    gap: "10px",
    marginTop: "12px",
  };
  const handleSelect = () => {
    navigation("/subpart", {state: {plan, price}});
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
                  <div className='subscription-bullet' style={{}}>
                    <img
                      style={
                        {
                          // filter: "invert(0.4) sepia(0.5) saturate(5) hue-rotate(175deg)",
                        }
                      }
                      src={checkIcon}
                      alt='checkmark'
                    />
                  </div>
                  <div style={{fontFamily: "Outfit", color: "white"}}>{el}</div>
                </span>
              ))}
            </div>
          </div>
          <MTBButton
            onClick={handleSelect}
            style={{
              borderRadius: "16px",
              width: "100%",
              flex: 1,
              backgroundColor: "#F18026",
              fontFamily: "Outfit",
              display: "inline",
              whiteSpace: "nowrap",
              justifySelf: "center",
              maxHeight: "52px",
              width: "70%",
              alignSelf: "center",
              marginBottom: "20px",
            }}>
            Try Now
          </MTBButton>
          <div
            style={{
              fontFamily: "Outfit",
              fontSize: "10px",
              color: "white",
              width: "95%",
              textAlign: "center",
              marginBottom: "10px",
              justifySelf: "flex-start",
            }}>
            {bottomText}
          </div>
        </div>
      ) : (
        <div className='unselected-subscription-item'>
          <div style={{}}>
            <div className='unselected-subscription-item-title'>
              ${price}
              <span style={{color: "#929191", fontSize: "20px"}}>/month</span>
            </div>
            <div className='unselected-subscription-item-subtitle'>{plan}</div>
            <div className='unselected-subscription-list'></div>
            {benefits.map((el, idx) => (
              <span key={idx} style={spanLineStyle}>
                <div
                  className='subscription-bullet'
                  style={{backgroundColor: "#43A4C226", alignItems: "center", lineHeight: "20px"}}>
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
          </div>
          <MTBButton
            onClick={handleSelect}
            style={{
              borderRadius: "16px",
              width: "100%",
              flex: 1,
              backgroundColor: "#231D4F",
              fontFamily: "Outfit",
              display: "inline",
              whiteSpace: "nowrap",
              justifySelf: "center",
              maxHeight: "52px",
              width: "70%",
            }}>
            Purchase
          </MTBButton>
          <div
            style={{
              fontFamily: "Outfit",
              fontSize: "10px",
              color: "#767979",
              width: "92%",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginLeft: "auto",
              justifyContent: "flex-start",
              marginTop: "-35px",
            }}>
            {bottomText}
          </div>
        </div>
      )}
    </>
  );
};

export default SubscriptionItem;
