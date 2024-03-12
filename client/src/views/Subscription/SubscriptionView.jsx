import React, {useEffect, useState} from "react";
import "./SubscriptionView.css";
import SubscriptionItem from "./SubscriptionItem";
import logo from "../../assets/logo.png";
import { useNavigate} from "react-router-dom";
import {getSystemSubscriptions} from "../../services/paymentService";

const SubscriptionView = () => {
  const navigation = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState("Basic");
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [systemSubscriptions, setSystemSubscriptions] = useState([]);
  const [paymentArray, setPaymentArray] = useState([]);
  useEffect(() => {
    const fetchSystemSubscriptions = async () => {
      try {
        const response = await getSystemSubscriptions();
        if (response.data) {
          setSystemSubscriptions(response.data);
        } else {
          console.log("No data received from getSystemSubscriptions");
        }
      } catch (error) {
        console.error("Failed to fetch system subscriptions:", error);
      }
    };
    fetchSystemSubscriptions();
   
  }, []);


  const handleSelectPlan = (plan, price) => {
    const planMap = {Basic: 1, Plus: 2, Premium: 3};
    const subsFiltered = systemSubscriptions.filter( ( sub ) => sub.level === planMap[ plan ] );
  
    setPaymentArray(subsFiltered);
    setSelectedPlan(plan);
    setSelectedPrice(price);
     navigation("/subpart", {state: {plan: plan, price: price, paymentArray: subsFiltered}});
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
              Pick a plan that best fits your business needs!
            </span>
          </div>
          <div className='Subscription-options'>
            <SubscriptionItem
              isSelected={selectedPlan === "Basic"}
              price={0}
              plan={"Basic"}
              benefits={[
                "3 ad spaces",
                "Quick Ad Tool",
                "Ticketing Options",
                "Generate business specific QR codes",
              ]}
              onClick={() => handleSelectPlan("Basic", 0)}
              bottomText={"Plan included in cost of subscription"}
            />
            <SubscriptionItem
              isSelected={selectedPlan === "Plus"}
              price={5.99}
              plan={"Plus"}
              benefits={["10 ad spaces", "Dedicated ad spaces", "Basic tier features included"]}
              onClick={() => handleSelectPlan("Plus", 5.99)}
              bottomText={
                "Free 30 day trail then $5.99 per month + subscription.  Offer only available for first time members. Billing according to subscription regularity. Terms apply."
              }
            />
            <SubscriptionItem
              isSelected={selectedPlan === "Premium"}
              price={10.99}
              plan={"Premium"}
              benefits={[
                "25 ad spaces",
                "Tour/Season space included",
                "Plus tier features included",
              ]}
              onClick={() => handleSelectPlan("Premium", 10.99)}
              bottomText={
                "Free 30 day trail then $10.99 per month + subscription. Offer only available for first time members. Billing according to subscription regularity.  Terms apply."
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionView;
