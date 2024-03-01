import React,{useState} from "react";
import "./SubscriptionView.css";
import SubscriptionItem from "./SubscriptionItem";
import logo from "../../assets/logo.png";
import {Outlet, useNavigate} from "react-router-dom";
const SubscriptionView = () => {
  const navigation = useNavigate()
  const [selectedPlan, setSelectedPlan] = useState("Basic");
  const [ selectedPrice, setSelectedPrice ] = useState( 0 );
  const handleSelectPlan = (plan,price) => {
    setSelectedPlan( plan );
    setSelectedPrice( price );
     navigation("/subpart", {state: {plan: plan, price:price}});
  };
  return (
    <div style={{flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh"}}>
      <div className='Subscription-view'>
        <div className='Subscription-icon'>
          <img src={logo} />
        </div>
        <div className='Subcription-main'>
          <div className='Subscription-header-text'>
            <span style={{fontSize: "72px", alignSelf: "center"}}>Unlock ad space</span>
            <span style={{fontSize: "36px", alignSelf: "center"}}>
              Pick a plan that's better for you!
            </span>
          </div>
          <div className='Subscription-options'>
            <SubscriptionItem
              isSelected={selectedPlan === "Basic"}
              price={0}
              plan={"Basic"}
              benefits={["3 ad spaces", "Benefits", "Benefits"]}
              onClick={() => handleSelectPlan("Basic",0)}
            />
            <SubscriptionItem
              isSelected={selectedPlan === "Plus"}
              price={5.99}
              plan={"Plus"}
              benefits={["10 ad spaces", "Specialized ad space", "Benefits"]}
              onClick={() => handleSelectPlan("Plus",5.99)}
            />
            <SubscriptionItem
              isSelected={selectedPlan === "Premium"}
              price={10.99}
              plan={"Premium"}
              benefits={["25 ad spaces", "Specialized ad space", "Tour/Season space included"]}
              onClick={() => handleSelectPlan("Premium",10.99)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionView;
