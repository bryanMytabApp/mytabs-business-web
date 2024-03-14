import React, {useEffect, useState} from "react";
import "./SubscriptionView.css";
import SubscriptionItem from "./SubscriptionItem";
import logo from "../../assets/logo.png";
import {useNavigate} from "react-router-dom";
import {MTBButton} from "../../components";
const SubscriptionSuccess = () => {
  const navigation = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState("Basic");
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [selectedBenefits, setSelectedBenefits] = useState([]);
  const planBenefits = {
    Basic: [
      "3 ad spaces",
      "Quick Ad Tool",
      "Ticketing Options",
      "Generate business specific QR codes",
    ],
    Plus: ["10 ad spaces", "Dedicated ad spaces", "Basic tier features included"],
    Premium: ["25 ad spaces", "Tour/Season space included", "Plus tier features included"],
  };
  const handleSelectPlan = (plan, price) => {
    setSelectedPlan(plan);
    setSelectedPrice(price);
    navigation("/subpart", {state: {plan: plan, price: price}});
  };

  useEffect(() => {
    let planData = JSON.parse(localStorage.getItem("checkoutResult"));
    setSelectedPlan(planData.plan);
    setSelectedPrice(planData.price);
    setSelectedBenefits(planBenefits["Basic"]);
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
          <div className='Subscription-options-success'>
            <SubscriptionItem
              isSuccess={true}
              isSelected={selectedPlan === "30-day free trial"}
              price={selectedPrice}
              plan={selectedPlan}
              benefits={selectedBenefits}
              onClick={() => navigation("/admin")}
            />
          </div>
        </div>

        <MTBButton
          onClick={() => navigation("/admin")}
          style={{
            borderRadius: "16px",
            width: "160px",
            flex: 1,
            backgroundColor: "#F09925",
            fontFamily: "Outfit",
            display: "inline",
            whiteSpace: "nowrap",
            justifySelf: "center",
            maxHeight: "52px",
            alignSelf: "center",
            marginRight: "120px",
            marginTop: "40px",
          }}>
          Continue!
        </MTBButton>
      </div>
    </div>
  );
};

export default SubscriptionSuccess;
