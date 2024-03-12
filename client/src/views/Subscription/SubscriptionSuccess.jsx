import React, {useEffect, useState} from "react";
import "./SubscriptionView.css";
import SubscriptionItem from "./SubscriptionItem";
import logo from "../../assets/logo.png";
import { useNavigate} from "react-router-dom";
const SubscriptionSuccess = () => {
  const navigation = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState("Basic");
  const [selectedPrice, setSelectedPrice] = useState(0);
  const handleSelectPlan = (plan, price) => {
    setSelectedPlan(plan);
    setSelectedPrice(price);
    navigation("/subpart", {state: {plan: plan, price: price}});
  };

  useEffect(() => {
    let planData = JSON.parse(localStorage.getItem("checkoutResult"));
    setSelectedPlan(planData.plan);
    setSelectedPrice(planData.price);
  }, []);
  return (
    <div style={{flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh"}}>
      <div className='Subscription-view'>
        <div className='Subscription-icon'>
          <img src={logo} />
        </div>
        <div className='Subcription-main'>
          <div className='Subscription-header-text'>
            <span style={{fontSize: "72px", alignSelf: "center"}}>Congratulations!</span>
            <span style={{fontSize: "36px", alignSelf: "center"}}>
              You have subscribed succesfully!
            </span>
          </div>
          <div className='Subscription-options'>
            <SubscriptionItem
              isSuccess={true}
              isSelected={selectedPlan === "30-day free trial"}
              price={selectedPrice}
              plan={selectedPlan}
              benefits={["Upgrade anytime!"]}
              onClick={() => navigation("/admin")}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSuccess;
