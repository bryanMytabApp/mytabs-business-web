import React from "react";
import bulletIcon from "../../assets/atoms/bulletSelector.svg";

const MTBCategorySelectItem = ({category, onClick}) => {
  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "110px",
        height: "110px",
        backgroundColor: "white",
        borderRadius: "15%",
        flexDirection: "column",
      }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          padding: "5px",
        }}>
        <img src={bulletIcon} alt='Bullet Icon' />
      </div>
      <div
        style={{
          textAlign: "center",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}>
        {category}
      </div>
    </div>
  );
};

export default MTBCategorySelectItem;
