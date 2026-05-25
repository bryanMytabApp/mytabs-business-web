import React from "react";
import styles from "./MTBComingSoon.module.css";
import {createMultipleClasses} from "../../utils/common";
import logo from "../../assets/logoTwo.png";
const MTBComingSoon = () => {
  return (
    <div className={createMultipleClasses([styles.view, styles.overlay])}>
      <div className={createMultipleClasses([styles.contentContainer])}>
        <img className={createMultipleClasses([styles.img])} src={logo} alt='logo' />
        <div className={createMultipleClasses([styles.title, styles.text])}>Find your world.</div>
        <div className={createMultipleClasses([styles.subTitle, styles.text])}>
          We're coming soon, stay tuned
        </div>
        <div className={createMultipleClasses([styles.subTitle, styles.text])}>
          for the launch...
        </div>
      </div>
    </div>
  );
};

export default MTBComingSoon;
