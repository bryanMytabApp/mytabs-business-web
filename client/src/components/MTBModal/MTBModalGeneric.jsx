import React, {useCallback, useEffect, useState} from "react";
import "./MTBModal.css";
import MTBButton from "../MTBButton/MTBButton";

import styles from "./MTBModalGeneric.module.css";
export default function MTBModalGeneric({
  data,
  isOpen,
  onClose,
  category,
  isOther,
  onSubCategoriesChange,
}) {
  const createMultipleClasses = (classes = []) => classes.join(" ");
  const currentPlan = 'Premium';
  const subscriptionEndDate = '2024-04-25'
  const [subCategories, setSubCategories] = useState([]);
  const [otherCategory, setOtherCategory] = useState("");

  const handleClick = (_subCategory) => {};

  const handleOtherCategory = (value) => {};

  const handleGoBack = () => {};

  const handleContinue = () => {
    setOtherCategory("");
    onClose();
  };
  if (!isOpen) return <div></div>;
  return (
    <>
      <div className='MTB-modal-overlay' onClick={onClose}>
        <div className='MTB-modal-content' onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <div className={styles.title}>
              <div>Are you sure you want to cancel?</div>
            </div>
          </div>
          <div className={styles.modalBody}>
            <div className={styles.modalText}>
              If you cancel your <span className={styles.spanText}>{currentPlan}</span> you will no longer be able to create and
              display your ads.
            </div>
            <div className={styles.modalText}>
              Your benefits will remain active until your subscription ends on <span>{subscriptionEndDate}</span>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <MTBButton
              hasOwnClassName={true}
              ownClassName={createMultipleClasses([styles.baseButton, styles.cancelButton])}
              onClick={handleGoBack}>
              No, go back
            </MTBButton>
            <MTBButton
              hasOwnClassName={true}
              ownClassName={createMultipleClasses([styles.baseButton, styles.acceptButton])}
              onClick={handleContinue}>
              Continue
            </MTBButton>
          </div>
        </div>
      </div>
    </>
  );
}
