import React, {useEffect, useState} from "react";
import "./MTBModal.css";
import MTBButton from "../MTBButton/MTBButton";
import MTBInput from "../MTBInput/MTBInput";
import church from "../../assets/categories/church.svg";
import {
  mdiGlassCocktail,
  mdiGlassMug,
  mdiFoodOutline,
  mdiCoffeeOutline,
  mdiSchoolOutline,
  mdiChurchOutline,
  mdiAccountOutline,
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
  mdiDanceBallroom
} from "@mdi/js";
import Icon from "@mdi/react";
import selectIcon from "../../assets/atoms/selectIcon.svg";
import selectIconActive from "../../assets/atoms/selectIconActive.svg";
const MTBModal = ({
  isOpen,
  onClose,
  children,
  category,
  isOther,
  subcategories,
  onSubCategoriesChange,
}) => {
  const [selectedSubCategories, setSelectedSubCategories] = useState([]);
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
    "Dance Hall": mdiDanceBallroom
  };
  if (!isOpen) return null;
  const iconPath = iconMap[category] || mdiAccountOutline;

  const handleClick = (_category) => {
    if (selectedSubCategories.includes(_category)) {
      setSelectedSubCategories((prev) => prev.filter((category) => category !== _category));
      if (onSubCategoriesChange) {
        onSubCategoriesChange((prev) => prev.filter((category) => category !== _category));
      }
    } else {
      setSelectedSubCategories((prev) => [...prev, _category]);
      if (onSubCategoriesChange) {
        onSubCategoriesChange((prev) => [...prev, _category]);
      }
    }
  };
  return (
    <>
      {isOther ? (
        <div className='MTB-modal-overlay' onClick={onClose}>
          <div className='MTB-modal-content' onClick={(e) => e.stopPropagation()}>
            <div className='MTB-icon-text'>
              <Icon path={iconPath} size={"48px"} color={"#00AAD6"} />
              <div>{category}</div>
            </div>
            <div style={{display: "flex", flex: 0.25}}></div>
            <div className='MTB-modal-second'>
              <div>Type the subcategory option</div>
              <div style={{display: "flex", flex: 0.75}}></div>
              <MTBInput type='category' value={category} placeholder='Type your category' />
            </div>
            <div className='MTB-modal-third'>
              <MTBButton onClick={onClose}>Close</MTBButton>
            </div>
          </div>
        </div>
      ) : (
        <div className='MTB-modal-overlay' onClick={onClose}>
          <div className='MTB-modal-content' onClick={(e) => e.stopPropagation()}>
            <div className='MTB-modal-first'>
              <div className='MTB-icon-text'>
                <Icon path={iconPath} size={"48px"} color={"#00AAD6"} />
                <div>{category}</div>
              </div>
            </div>
            <div className='MTB-modal-second'>
              <div>Select one subcategory or continue</div>

              <ul className='MTB-subcategory-grid'>
                {subcategories.map((subcategory, index) => (
                  <li key={index} onClick={() => handleClick(subcategory)}>
                    <img
                      src={
                        selectedSubCategories.includes(subcategory) ? selectIconActive : selectIcon
                      }
                      alt='selectIcon'
                    />
                    <span
                      style={{
                        color: selectedSubCategories.includes(subcategory) ? "#00AAD6" : "#000000",
                      }}>
                      {subcategory}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <MTBInput type='category' value={category} placeholder='Type your category' />
            <div className='MTB-modal-third'>
              <MTBButton onClick={onClose}>Continue</MTBButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MTBModal;
