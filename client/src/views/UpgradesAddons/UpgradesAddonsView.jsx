import React from "react";
import styles from "./UpgradesAddonsView.module.css";
import {useNavigate} from "react-router-dom";
import {IconButton} from "@mui/material/";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import UpgradeItem from "./UpgradeItem";

const UpgradesAddonsView = () => {
  const navigation = useNavigate();
  const handleGoBack = () => navigation("/admin/home");

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
            index={1}
            isSelected={true}
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
            index={2}
            isSelected={false}
            price={5.99}
            plan={"Plus"}
            benefits={["10 ad spaces", "Dedicated ad spaces", "Basic tier features included"]}
            bottomText={"Plan included in cost of subscription"}
          />
          <UpgradeItem
            index={3}
            isSelected={false}
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
