import React, {useEffect, useState} from "react";
import {useNavigate, useLocation} from "react-router-dom";
import "./SubscriptionView.css";
import mobileMTB from "../../assets/mobileMTB.png";
import logo from "../../assets/logo.png";
import {MTBButton} from "../../components";
import backArrow from "../../assets/backArrow.svg";
import {MTBSubscriptionRateCard} from "../../components";
import lockIcon from "../../assets/lock.svg";
import {useStripe, useElements, CardElement} from "@stripe/react-stripe-js";
import {createCheckoutSession} from "../../services/paymentService";
const SubscriptionViewPart = ({state}) => {
  const stripe = useStripe();
  const elements = useElements();
  const location = useLocation();
  const {plan, price} = location.state || {plan: "Basic", price: 0};
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState("monthly");
  const [selectedRate, setSelectedRate] = useState(13.99);
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const navigation = useNavigate();
  const CARD_ELEMENT_OPTIONS = {
    style: {
      base: {
        fontSize: "16px",
        color: "#424770",
        "::placeholder": {
          color: "#aab7c4",
        },
      },
      invalid: {
        color: "#fa755a",
      },
    },
  };
  const handleShowPaymentForm = () => {
    setShowPaymentForm(!showPaymentForm);
  };

  const handleSelectPaymentPlan = (paymentPlan, rate) => {
    setSelectedPaymentPlan(paymentPlan);
    setSelectedRate(rate);
  };
  useEffect(() => {
    console.log("SubscriptionViewPart is mounting");
    console.log(plan, price);
  }, []);

  // TODO:
  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    if (!stripe || !elements) {
      console.log("Stripe has not loaded yet.");
      setIsLoading(false);
      return;
    }

    const cardElement = elements.getElement(CardElement);
    const {error, paymentMethod} = await stripe.createPaymentMethod({
      type: "card",
      card: cardElement,
    });

    if (error) {
      console.log("[Error]", error);
      setIsLoading(false);
    } else {
      const sessionData = {
        paymentMethodId: paymentMethod.id,
        plan: selectedPaymentPlan,
        price: selectedRate,
      };

      try {
        const response = await createCheckoutSession(sessionData);
        console.log("[response]: ", response);

        console.log("Subscription creation response:", response);
        navigation("/admin/dashboards");
      } catch (error) {
        console.error("Failed to create subscription:", error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className='Subscription-view'>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-around",
          alignItems: "center",
          width: "100%",
        }}
        className='Subcrition-main'>
        <div style={{display: "flex"}} className='Subscription-options-rates'>
          <div style={{marginTop: "15px", marginLeft: "15px"}}>
            <img src={logo}></img>
          </div>
          <div className='subscription-options-block' style={{padding: "0 50px"}}>
            <span
              style={{
                fontFamily: "Outfit",
                lineHeight: "40px",
                fontWeight: 700,
                fontSize: "36px",
              }}>
              Choose your subscription
              <span
                style={{
                  fontFamily: "Outfit",
                  lineHeight: "40px",
                  fontWeight: 700,
                  fontSize: "36px",
                  color: "green",
                }}>
                {" "}
                +{plan}
              </span>
            </span>

            <table style={{marginTop: "20px"}}>
              <tr colspan='2' style={{marginTop: "20px"}}>
                <td>
                  <MTBSubscriptionRateCard
                    rate={7.99}
                    period={"yearly"}
                    isSelected={selectedPaymentPlan === "yearly"}
                    onClick={() => handleSelectPaymentPlan("yearly", 7.99)}
                  />
                </td>
                <td>
                  <MTBSubscriptionRateCard
                    rate={10.99}
                    period={"quarterly"}
                    isSelected={selectedPaymentPlan === "quaterly"}
                    onClick={() => handleSelectPaymentPlan("quaterly", 10.99)}
                  />
                </td>
              </tr>
              <tr style={{marginTop: "20px"}}>
                <td colspan='2'>
                  <MTBSubscriptionRateCard
                    rate={13.99}
                    period={"monthly"}
                    isSelected={selectedPaymentPlan === "monthly"}
                    onClick={() => handleSelectPaymentPlan("monthly", 13.99)}
                  />
                </td>
              </tr>
            </table>
            <div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 500,
                  fontFamily: "Outfit",
                  color: "#7c7b7b",
                  justifyItems: "center",
                  display: "flex",
                  alignItems: "center",
                  marginTop: "20px",
                }}>
                {plan}: ${price} /month
              </div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 500,
                  fontFamily: "Outfit",
                  color: "#7c7b7b",
                  justifyItems: "center",
                  display: "flex",
                  alignItems: "center",
                  marginTop: "20px",
                }}>
                + ${selectedRate} /month
              </div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 500,
                  fontFamily: "Outfit",
                  color: "#7c7b7b",
                  justifyItems: "center",
                  display: "flex",
                  alignItems: "center",
                  marginTop: "20px",
                }}>
                Total: ${price + selectedRate} /month
              </div>
              <div
                className=''
                style={{
                  fontSize: "16px",
                  fontWeight: 500,
                  fontFamily: "Outfit",
                  color: "#7c7b7b",
                  justifyItems: "center",
                  display: "flex",
                  alignItems: "center",
                  marginTop: "20px",
                }}>
                <img src={lockIcon}></img>
                &nbsp; Payments secured with &nbsp;
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: 500,
                    fontFamily: "Outfit",
                    color: "#00AAD6",
                  }}>
                  Stripe
                </span>
              </div>
            </div>
          </div>
          <div className='Subscription-footer'>
            <div
              onClick={() => navigation("/subscription")}
              style={{
                display: "flex",
                flex: 2,
                justifyContent: "flex-start",
                alignItems: "center",
                marginLeft: "10px",
              }}>
              <img src={backArrow} alt='backArrow' />
              Back
            </div>
            <MTBButton
              onClick={handleShowPaymentForm}
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
                width: "20%",
                alignSelf: "center",
                marginRight: "10px",
              }}>
              Subscribe for ${price + selectedRate}/month
            </MTBButton>
          </div>
        </div>
        <div style={{display: "flex", flex: "1 1 1", alignSelf: "flex-end", marginTop: "200px"}}>
          <img src={mobileMTB} alt='lockIcon' />
        </div>
      </div>

      {/* Your form elements and subscription options */}
      {showPaymentForm && (
        <div className='fullscreen-container'>
          <form
            onSubmit={handleSubmit}
            style={{width: "500px", background: "white", padding: "20px", borderRadius: "8px", height: "40px"}}>
            {/* Render CardElement here */}
            <CardElement options={CARD_ELEMENT_OPTIONS} />
            <button type='submit' disabled={!stripe}>
              Pay
            </button>
            <button type='button' onClick={handleShowPaymentForm}>
              Cancel
            </button>
          </form>
        </div>
      )}
      <button type='submit' disabled={!stripe || isLoading} onClick={handleShowPaymentForm}>
        {isLoading ? "Processing…" : `Subscribe for $${price + selectedRate}/year`}
      </button>
    </div>
  );
};

export default SubscriptionViewPart;
