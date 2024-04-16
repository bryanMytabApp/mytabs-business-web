import React, {useState, useEffect} from "react";
import styles from "./UpgradesAddonsView.module.css";
import {useNavigate, useLocation} from "react-router-dom";
import {IconButton} from "@mui/material/";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import UpgradeItem from "./UpgradeItem";
import {
  updateCustomerSubscription,
  getSystemSubscriptions,
  getCustomerSubscription,
} from "../../services/paymentService";
import {useStripe} from "@stripe/react-stripe-js";
let userId;

const UpgradesAddonsView = () => {
  const [ showPaymentForm, setShowPaymentForm ] = useState( false );
  const [ currentLevel, setCurrentLevel ] = useState( 1 );
  const [ currentSublevel, setCurrentSublevel ] = useState( 1 );
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState("monthly");
  const [levelPayment, setLevelPayment] = useState(1);
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [systemSubscriptions, setSystemSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentArray, setPaymentArray] = useState([]);
  const stripe = useStripe();
  const location = useLocation();
  const navigation = useNavigate();
  const handleGoBack = () => navigation("/admin/home");

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

  const getCustomerSubscriptionWrapper = async ({ userId, subscriptionList}) => {
    let res = await getCustomerSubscription( {userId} )
    
    let subItem = subscriptionList.find( ( el ) => el.priceId == res.data.priceId )
    setCurrentLevel( subItem.level )
    setCurrentSublevel( subItem.sublevel )
    return res
  }

  useEffect( () => {
  
    const token = localStorage.getItem("idToken");
    userId = parseJwt( token );
     
    const fetchSystemSubscriptions = async () => {
      try {
        const response = await getSystemSubscriptions();
        if (response.data) {
          setSystemSubscriptions( response.data );
          getCustomerSubscriptionWrapper( { userId, subscriptionList: response.data });
          console.log(response.data);
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
    setLevelPayment(plan);
    const planMap = {Basic: 1, Plus: 2, Premium: 3};
    const subsFiltered = systemSubscriptions.filter((sub) => sub.level === planMap[plan]);
    setPaymentArray(subsFiltered);
    setSelectedPaymentPlan(plan);
    setSelectedPrice(price);
    // handleSubmit();
    navigation("/subpart", {state: {plan: plan, price: price, paymentArray: subsFiltered, isUpdating: true}});
  };
  const getPaymentSubscriptionId = (paymentMethod, level = 1) => {
    console.log(paymentMethod, paymentArray);
    let [res] = systemSubscriptions.filter((subscription) => {
      return subscription.sublevel === paymentMethod && subscription.level === levelPayment;
    });
    return res._id;
  };

  const handleShowPaymentForm = () => {
    setShowPaymentForm(!showPaymentForm);
  };
  const initiateCheckout = async (sessionID) => {
    try {
      const result = await stripe.redirectToCheckout({sessionId: sessionID});
      // Handle success
        if (result) {
          console.error("Stripe Checkout error:", result.error.message);
        }
    } catch (error) {
      console.error("Error in redirectToCheckout:", error);
    }
  }

  const handleSubmit = async (event) => {
    handleShowPaymentForm();
    const subscriptionId = getPaymentSubscriptionId("monthly", levelPayment);

    const sessionData = {
      userId: userId,
      sublevel: "yearly",
      level: levelPayment,
    };

    try {
      if (!userId || !subscriptionId) {
        throw new Error("User not found and sessionID ");
      }
      if (userId && subscriptionId) {
        const response = await updateCustomerSubscription(sessionData);
        console.log("🚀 ~ handleSubmit ~ response:", response.data.sessionId);
        if (!response.data.sessionId) {
          throw new Error("No client secret returned from server");
        }
         let paymentData = {
           price: selectedPrice,
           plan: levelPayment,
         };
         localStorage.setItem("checkoutResult", JSON.stringify(paymentData));
        const clientSecret = response.data.sessionId;
        console.log("🚀 ~ handleSubmit ~ clientSecret:", clientSecret);

  
        const checkout = await initiateCheckout(response.data.sessionId)
        if ( !checkout ) {
          throw new Error( 'Unable to redirect to checkout' );
        }
        console.log("🚀 ~ handleSubmit ~ checkout:", checkout);
       
        checkout.mount("#mytabsStripe");
      }
    } catch (error) {
      console.error("Failed to create subscription:", error);
      setShowPaymentForm(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.view}>
      <div className={styles.contentContainer}>
        <div className={styles.titleContainer}>
          <IconButton aria-label='delete' onClick={handleGoBack}>
            <ArrowBackIcon />
          </IconButton>
          <h1>Subscription Plans</h1>
        </div>
        <div className={styles.mainContainer}>
          <div className={styles.subTitle}>Subscription Plans</div>
          <UpgradeItem
            onClick={() => handleSelectPlan("Basic", 0)}
            index={1}
            isSelected={currentLevel === 1}
            price={0}
            plan={"Basic"}
            benefits={[
              "3 ad spaces",
              "Quick Ad Tool",
              "Ticketing Options",
              "Generate business specific QR codes",
            ]}
            bottomText={"Plan included in cost of subscription"}
          />
          <UpgradeItem
            onClick={() => handleSelectPlan("Plus", 5.99)}
            index={2}
            isSelected={currentLevel === 2}
            price={5.99}
            plan={"Plus"}
            benefits={["10 ad spaces", "Dedicated ad spaces", "Basic tier features included"]}
            bottomText={"Plan included in cost of subscription"}
          />
          <UpgradeItem
            onClick={() => handleSelectPlan("Premium", 10.99)}
            index={3}
            isSelected={currentLevel === 3}
            price={10.99}
            plan={"Premium"}
            benefits={["25 ad spaces", "Tour/Season space included", "Plus tier features included"]}
            bottomText={"Plan included in cost of subscription"}
          />
        </div>
      </div>
    </div>
  );
};

export default UpgradesAddonsView;
