import React from "react";
import "./SubscriptionView.css";
import SubscriptionItem from "./SubscriptionItem";
import logo from "../../assets/logo.png"
const SubscriptionView = () => {
  return (
    <div className='Subscription-view'>
      <div className='Subscription-icon'>
        <img src={ logo} />
      </div>
      <div className='Subcription-main'>
        <div className='Subscription-header-text'>
          <span style={{fontSize: "72px", alignSelf: "center"}}>Unlock ad space</span>
          <span style={{fontSize: "36px", alignSelf: "center"}}>Pick a plan that's better for you!</span>
        </div>
        <div className='Subscription-options'>
          <SubscriptionItem
            isSelected={true}
            price={0}
            plan={"Basic"}
            benefits={["3 ad spaces", "Benefits", "Benefits"]}
          />
          <SubscriptionItem
            isSelected={false}
            price={5.99}
            plan={"Plus"}
            benefits={["10 ad spaces", "Specialized ad space", "Benefits"]}
          />
          <SubscriptionItem
            isSelected={false}
            price={10.99}
            plan={"Premium"}
            benefits={["25 ad spaces", "Specialized ad space", "Tour/Season space included"]}
          />
        </div>
      </div>
    </div>
  );
};

export default SubscriptionView;
