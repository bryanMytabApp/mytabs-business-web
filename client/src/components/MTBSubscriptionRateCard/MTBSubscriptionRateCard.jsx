import React from "react";
import unselectedCircle from "../../assets/unselectedCircle.svg"
import selectedCircle from "../../assets/selectedCircle.svg"

import "./MTBSubscriptionRateCard.css";

export default function MTBSubscriptionRateCard({ rate, period, isSelected, onClick }) {
  const cardClassName = `MTBSubscriptionRateCard-main ${isSelected ? 'selected' : 'unselected'}`;
  const selectionClassName = isSelected ? 'selected' : '';
  const capitalizedPeriod = period.charAt(0).toUpperCase() + period.slice(1);
  return (
    <div className={cardClassName} onClick={onClick}>
      <div className="ratePeriodAndSelection">
        <div className={`ratePeriod ${selectionClassName}`}>
          {capitalizedPeriod}
        </div>
        <div className="selectionIcon">
          <img src={isSelected ? selectedCircle : unselectedCircle} alt="circle selection" />
        </div>
      </div>
      <div className={`rateValue ${selectionClassName}`}>
        {isSelected ? `$${rate} USD` : `${rate}`}
        <span className="rateSuffix">&nbsp;/month</span>
      </div>
      <div className={`billingInfo ${selectionClassName}`}>
       {isSelected ? "Start free trial!" : `Billed ${period}`}
      </div>
    </div>
  );
}
