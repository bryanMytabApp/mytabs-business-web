import React, {useCallback, useEffect, useState} from "react";
import "./MTBModal.css";
import MTBButton from "../MTBButton/MTBButton";
import MTBInput from "../MTBInput/MTBInput";
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
  mdiDanceBallroom,
} from "@mdi/js";
import Icon from "@mdi/react";
import selectIcon from "../../assets/atoms/selectIcon.svg";
import selectIconActive from "../../assets/atoms/selectIconActive.svg";

const MTBModal = ({
  data,
  isOpen,
  onClose,
  category,
  isOther,
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
    "Dance Hall": mdiDanceBallroom,
  };

  const [subCategories, setSubCategories] = useState([]);
  const [otherCategory, setOtherCategory] = useState("");
  
  const iconPath = iconMap[category.name] || mdiAccountOutline;

  const handleClick = (_subCategory) => {
    if (subCategories.includes(_subCategory)) {
      let _subCategories = subCategories.filter((subCat) => subCat !== _subCategory);
      setSubCategories(_subCategories);
      return;
    }
    setOtherCategory("");
    setSubCategories([_subCategory]);
  };

  const handleOtherCategory = (value) => {
    setSubCategories([]);
    setOtherCategory(value);
  };

  const handleContinue = () => {

      const _category = JSON.parse(JSON.stringify(category));
      if (subCategories.length) {
        _category.subcategories = subCategories;
      } else {
        _category.subcategories = [otherCategory];
      }

      onSubCategoriesChange(_category);
      setSubCategories([]);
      setOtherCategory("");
      onClose();
  };
  if (!isOpen) return <div></div>;
  return (
    <>
      <div className='MTB-modal-overlay' onClick={onClose}>
        <div className='MTB-modal-content' onClick={(e) => e.stopPropagation()}>
          <div className='MTB-modal-first'>
            <div className='MTB-icon-text'>
              <Icon path={iconPath} size={"48px"} color={"#00AAD6"} />
              <div>{category.name}</div>
            </div>
          </div>
          <div className='MTB-modal-second'>
            <div>Select one subcategory or continue</div>

            <ul className='MTB-subcategory-grid'>
              {category.subcategories?.map((subcategory, index) => (
                <li key={index} onClick={() => handleClick(subcategory)}>
                  <img
                    src={subCategories.includes(subcategory) ? selectIconActive : selectIcon}
                    alt='selectIcon'
                  />
                  <span
                    style={{
                      color: subCategories.includes(subcategory) ? "#00AAD6" : "#000000",
                    }}>
                    {subcategory}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <MTBInput
            type='category'
            value={otherCategory}
            placeholder='Type your category'
            onChange={handleOtherCategory}
            name='subcategoryInput'
          />
          <div className='MTB-modal-third'>
            <MTBButton onClick={handleContinue}>Continue</MTBButton>
          </div>
        </div>
      </div>
    </>
  );
};

export default MTBModal;
