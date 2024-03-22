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
    "Dance Hall": mdiDanceBallroom,
  };
  const [otherCategory, setOtherCategory] = useState({"categoryName": "", otherCategoryValue:""});
  if (!isOpen) return null;
  const iconPath = iconMap[category] || mdiAccountOutline;

  const handleClick = (_category) => {
    if (selectedSubCategories.length && selectedSubCategories.includes(_category)) {
      const _filteredArray = [...selectedSubCategories].filter(
        (category) => category !== _category
      );
      setSelectedSubCategories(_filteredArray);
    } else {
      setSelectedSubCategories([_category]);
    }
  };

  const handleOtherCategory = (name, value) => {
    setSelectedSubCategories( ( prev ) => prev.filter( ( category ) => !category.isText ) )
    let newOtherCategory = {categoryName: category, otherCategoryValue: name};
    setOtherCategory(newOtherCategory);
    console.log(" [handleOther] data", data.subcategory);
    console.log(" [handleOther] selectedSubCategories ", selectedSubCategories);
    console.log(" [handleOther] name ", name );
    // let a = selectedSubCategories.filter((category) => category.isText).name;
    setSelectedSubCategories([newOtherCategory]);
  };

  const handleContinue = () => {
    onClose();
    let res = Array.from(new Set(selectedSubCategories));
    onSubCategoriesChange((prev) => Array.from(new Set([...prev, ...res])));
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
              <MTBInput
                type='category'
                value={otherCategory}
                placeholder='Type your category'
                onChange={handleOtherCategory}
                name='subcategoryInput'
              />
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
      )}
    </>
  );
};

export default MTBModal;
