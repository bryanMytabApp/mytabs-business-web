import React, {useState, useEffect} from "react";
import styles from "./UpgradesAddonsView.module.css";
import {useNavigate, useLocation} from "react-router-dom";
import {IconButton} from "@mui/material/";
import {MTBLoading, MTBModalGeneric} from "../../components";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import UpgradeItem from "./UpgradeItem";
import {parseJwt} from "../../utils/common";
import {
  getSystemSubscriptions,
  getCustomerSubscription,
  cancelCustomerSubscription,
} from "../../services/paymentService";
import {toast} from "react-toastify";
import moment from "moment";

let userId;
let currentSubscription;
let currentLevelString;
const SUBSCRIPTION_PLANS = ["Basic", "Plus", "Premium"];
const UpgradesAddonsView = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeButtons, setActiveButtons] = useState(SUBSCRIPTION_PLANS);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentSublevel, setCurrentSublevel] = useState(1);
  const [selectedPaymentPlan, setSelectedPaymentPlan] = useState("monthly");
  const [levelPayment, setLevelPayment] = useState(1);
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [systemSubscriptions, setSystemSubscriptions] = useState([]);
  const [paymentArray, setPaymentArray] = useState([]);
  const [endOfSubscription, setEndOfSubscription] = useState("");
  const navigation = useNavigate();
  const handleGoBack = () => navigation("/admin/home");

  const getCustomerSubscriptionWrapper = async ({userId, subscriptionList}) => {
    let res = await getCustomerSubscription({userId});

    currentSubscription = res.data;
    console.log(currentSubscription,"currentSub")
    let endOfSubscriptionDate = moment(currentSubscription.currentPeriodEnd * 1000).format(
      "MM-DD-YYYY"
    );
    setEndOfSubscription(endOfSubscriptionDate);
    let subItem = subscriptionList.find((el) => el.priceId == res.data.priceId);
    if (subItem.level == 3) {
      setActiveButtons(["Premium"]);
    }
    if (subItem.level == 2) {
      setActiveButtons(["Plus", "Premium"]);
    }
    if (subItem.level == 1) {
      setActiveButtons(SUBSCRIPTION_PLANS);
    }
    currentLevelString = SUBSCRIPTION_PLANS[subItem.level - 1];
    setCurrentLevel(subItem.level);
    setCurrentSublevel(subItem.sublevel);
    return res;
  };

  useEffect(() => {
    const token = localStorage.getItem("idToken");
    userId = parseJwt(token);
    setIsLoading(true)
    const fetchSystemSubscriptions = async () => {
      try {
        const response = await getSystemSubscriptions();
        if (response.data) {
          setSystemSubscriptions(response.data);
          getCustomerSubscriptionWrapper({userId, subscriptionList: response.data});
          setIsLoading(false)
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
    navigation("/subpart", {
      state: {plan: plan, price: price, paymentArray: subsFiltered, isUpdating: true},
    });
  };

  const handleContinue = async () => {
    try {
      setIsLoading(true);
      let res = await cancelCustomerSubscription(userId);
      res = JSON.parse(res);
      if (res.status === "success") {
        toast.success(res.message);
      }
      if (res.status == "error") {
        toast.error(res.message);
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
    }
    setIsOpen(false);
  };
  if (isLoading) {
    return (
      <div className={styles.view}>
        <MTBLoading />
      </div>
    );
  }
  return (
    <>
      {isOpen ? (
        <MTBModalGeneric
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          handleContinue={handleContinue}
          subscriptionEndDate={endOfSubscription}
          currentPlan={currentLevelString}
          isLoading={isLoading}
        />
      ) : (
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
                isDisabled={activeButtons.length < 3}
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
                isDisabled={activeButtons.length < 2}
                isSelected={currentLevel === 2}
                price={5.99}
                plan={"Plus"}
                benefits={["10 ad spaces", "Dedicated ad spaces", "Basic tier features included"]}
                bottomText={"Plan included in cost of subscription"}
              />
              <UpgradeItem
                onClick={() => handleSelectPlan("Premium", 10.99)}
                index={3}
                isDisabled={activeButtons.length < 1}
                isSelected={currentLevel === 3}
                price={10.99}
                plan={"Premium"}
                benefits={[
                  "25 ad spaces",
                  "Tour/Season space included",
                  "Plus tier features included",
                ]}
                bottomText={"Plan included in cost of subscription"}
              />
            </div>
            <div className={styles.cancelSubscriptionButton} onClick={() => setIsOpen(true)}>
              Cancel subscription
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default UpgradesAddonsView;
