import React, {useEffect, useState} from "react";
import selectIcon from "../../assets/atoms/selectIcon.svg";
import selectIconActive from "../../assets/atoms/selectIconActive.svg";
import Icon from "@mdi/react";
import circusIcon from "../../assets/categories/circus.svg";
import {
  mdiGlassCocktail,
  mdiAccountOutline,
  mdiGlassMug,
  mdiFoodOutline,
  mdiCoffeeOutline,
  mdiSchoolOutline,
  mdiChurchOutline,
  mdiMessageOutline,
  mdiLibraryOutline,
  mdiStadiumOutline,
  mdiTheater,
  mdiHairDryerOutline,
  mdiCharity,
  mdiMusic,
  mdiBaseball,
  mdiDumbbell,
  mdiShopping,
  mdiDanceBallroom,
} from "@mdi/js";

const iconMap = {
  Club: mdiGlassCocktail,
  Bar: mdiGlassMug,
  Restaurant: mdiFoodOutline,
  Café: mdiCoffeeOutline,
  School: mdiSchoolOutline,
  "Worship Center": mdiChurchOutline,
  Religion: mdiChurchOutline,
  Other: mdiMessageOutline,
  Library: mdiLibraryOutline,
  Stadium: mdiStadiumOutline,
  Arena: mdiStadiumOutline,
  Theater: mdiTheater,
  "Food Truck": mdiFoodOutline,
  "Hair Salon": mdiHairDryerOutline,
  Charity: mdiCharity,
  Museum: mdiLibraryOutline,
  Music: mdiMusic,
  Sports: mdiBaseball,
  Gym: mdiDumbbell,
  Store: mdiShopping,
  "Dance Hall": mdiDanceBallroom,
};
const MTBCategorySelectItem = ({category, onClick, subcategories, clicked }) => {

  const iconPath = iconMap[category] || mdiAccountOutline;
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
          top: "2px",
          right: "2px",
          padding: "5px",
        }}>
        <img
          style={{justifySelf: "flex-end"}}
          src={clicked ? selectIconActive : selectIcon}
          alt='bullet'
        />
      </div>
      <div
        style={{
          textAlign: "center",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "16px",
          fontWeight: 500,
          fontFamily: "Outfit",
          color: "#676565",
        }}>
        <Icon path={iconPath} size={"40px"} color={clicked ? "#00AAD7" : "#919797"} />
        {category}
      </div>
    </div>
  );
};

export default MTBCategorySelectItem;
