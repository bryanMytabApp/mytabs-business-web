import React from "react";
import styles from "./UpgradesAddonsView.module.css";

import checkIcon from "../../assets/atoms/check.svg";

const UpgradeItem = ({isSelected, price, plan, benefits, index, onClick}) => {
  const createMultipleClasses = (classes = []) => classes.join(" ");
  const priceHTML = isSelected ? (
    <>
      <h2 className={styles.priceHTML}>Included</h2>
      <h3>{plan}</h3>
    </>
  ) : (
    <>
      <h2 className={styles.priceHTML}>
        ${price}
        <span>/month</span>
      </h2>
      <h3>{plan}</h3>
    </>
  );
  return (
    <div className={styles[`upgradeItem-${index}`]}>
      <div className={styles.upgradeItemTitle}>{priceHTML}</div>
      <div className={styles.upgradeItemBenefits}>
        {benefits.map((el, idx) => (
          <span key={idx} className={styles.spanLineStyle}>
            <div className={styles.bulletIcon}>
              <img src={checkIcon} alt='checkmark' />
            </div>
            <div className={styles.benefitText}>{el}</div>
          </span>
        ))}
      </div>
      <div className={styles.buttonPosition}>
        {isSelected ? (
          <button className={createMultipleClasses([styles.baseButton, styles.exportButton])}>
            Current Plan
          </button>
        ) : (
          <button onClick={onClick} className={createMultipleClasses([styles.baseButton, styles.createEventButton])}>
            Upgrade Plan
          </button>
        )}
      </div>
    </div>
  );
};

export default UpgradeItem;