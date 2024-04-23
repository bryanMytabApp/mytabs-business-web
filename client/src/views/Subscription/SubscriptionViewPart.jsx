import React, {useEffect, useState} from "react";
import {useNavigate, useLocation, useParams} from "react-router-dom";
import "./SubscriptionView.css";
import mobileMTB from "../../assets/mobileMTB.png";
import logo from "../../assets/logo.png";
import {MTBButton} from "../../components";
import backArrow from "../../assets/backArrow.svg";
import {MTBSubscriptionRateCard} from "../../components";
import lockIcon from "../../assets/lock.svg";
import {useStripe, useElements} from "@stripe/react-stripe-js";
import {createCheckoutSession, updateCustomerSubscription} from "../../services/paymentService";

let userId;
const SubscriptionViewPart = ( { state } ) => {

  const { sessionId } = useParams();
  const [ prorationAmount, setProrationAmount ] = useState( 0 );
  const [prorationMessage, setProrationMessage] = useState("");
  const stripe = useStripe();
  const location = useLocation();
  const {plan, price, paymentArray, isUpdating} = location.state || {plan: "Basic", price: 0, paymentArray: [], isUpdating: false};
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState("monthly");
  const [selectedRate, setSelectedRate] = useState(13.99);
  const [isLoading, setIsLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const navigation = useNavigate();
  const backButton = (isUpdating) => navigation(isUpdating ? "/admin/upgrades-and-add-ons":"/subscription");
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
  const parseJwt = (token) => {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );

    return JSON.parse(jsonPayload)["custom:user_id"];
  };

  useEffect( () => {
    const token = localStorage.getItem("idToken");
    userId = parseJwt(token);
  }, []);

  const initiateCheckout = async (sessionID, paymentData) => {
    try {
      const result = await stripe.redirectToCheckout({sessionId: sessionID});
      // Handle 
      console.log(1)
      if (result) {
        console.error( "Stripe Checkout error:", result.error.message );

        localStorage.setItem( "checkoutResult", JSON.stringify( paymentData ) );

      }
    } catch (error) {
      console.error("Error in redirectToCheckout:", error);
    }
  };

  const getPaymentSubscriptionId = ( paymentMethod ) => {
   
    let res = paymentArray.find((subscription) => {
      return subscription.sublevel === paymentMethod;
    })._id;
    return res;
  };


const handleSubmitUpdate = async (event) => {
  handleShowPaymentForm();
  
  const subscriptionId = getPaymentSubscriptionId(selectedPaymentPlan);
  const subs = {Basic: 1, Plus: 2, Premium: 3};
  const sessionData = {
    userId: userId,
    sublevel: selectedPaymentPlan,
    level: subs[ plan ],
    newSubId: subscriptionId
  };

  try {
    if (!userId || !subscriptionId) {
      throw new Error("User not found and sessionID ");
    }
    if (userId && subscriptionId) {
      const response = await updateCustomerSubscription( sessionData );
      console.log("🚀 ~ handleSubmitUpdate ~ response:", response.data);
      if (response.data && response.data.prorationDetails) {
        setProrationAmount(response.data.prorationDetails.price);
        setProrationMessage(response.data.prorationDetails.price_data);
      }
      if (!response.data.sessionId) {
        throw new Error("No client secret returned from server");
      }
      if ( !price || !selectedRate || !plan ) {
        alert("price not found")
        console.error("Price, selectedRate or plan is not defined");
      }
      let paymentData = {
        price: price + selectedRate,
        plan: plan,
      };
      
      localStorage.setItem( "checkoutResult", JSON.stringify( paymentData ) );
      const clientSecret = response.data.sessionId;
      await initiateCheckout( clientSecret, paymentData );

      console.log(paymentData, "paymenteDATa")
    }
  } catch (error) {
    console.error("Failed to create subscription:", error);
    setShowPaymentForm(false);
  } finally {
    setIsLoading(false);
  }
};


  const handleSubmit = async (event) => {
    handleShowPaymentForm();

    const subscriptionId = getPaymentSubscriptionId(selectedPaymentPlan);

    const sessionData = {
      userId: userId,
      subscriptionId: subscriptionId,
    };

    try {
      if (!userId || !subscriptionId) {
        throw new Error("User not found and sessionID ");
      }
      if (userId && subscriptionId) {
       
        const response = await createCheckoutSession(sessionData);
        console.log("🚀 ~ handleSubmit ~ response:", response);
        if (!response.client_secret) {
          throw new Error("No client secret returned from server");
        }
        const clientSecret = response.client_secret;
        console.log("🚀 ~ handleSubmit ~ clientSecret:", clientSecret);

        const checkout = await stripe.initEmbeddedCheckout({
          clientSecret,
        });
        console.log("🚀 ~ handleSubmit ~ checkout:", checkout);
        let paymentData = {
          price: price + selectedRate,
          plan: plan,
        };
        localStorage.setItem("checkoutResult", JSON.stringify(paymentData));
        checkout.mount("#mytabsStripe");
      }
    } catch (error) {
      console.error("Failed to create subscription:", error);
      setShowPaymentForm(false);
    } finally {
      let paymentData = {
        price: price + selectedRate,
        plan: plan,
      };
      localStorage.setItem("checkoutResult", JSON.stringify(paymentData));
      setIsLoading(false);
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
                    isSelected={selectedPaymentPlan === "quarterly"}
                    onClick={() => handleSelectPaymentPlan("quarterly", 10.99)}
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
              onClick={backButton}
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
              onClick={isUpdating ? handleSubmitUpdate : handleSubmit}
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

      {showPaymentForm && <div className='fullscreen-container' id='mytabsStripe'></div>}
    </div>
  );
};

export default SubscriptionViewPart;
