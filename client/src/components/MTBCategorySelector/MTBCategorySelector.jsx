import React, {useEffect, useState} from "react";
import MTBCategorySelectItem from "./MTBCategorySelectItem";
import "./MTBCategorySelector.css";
import MTBModal from "../MTBModal/MTBModal";
import categoriesJS from "../../utils/data/categories";
import {toast} from "react-toastify";

const MTBCategorySelector = ({onChange = () => {}, data, filteredCategories}) => {
  const [openModal, setOpenModal] = useState(false);
  const [currentCategory, setCurrentCategory] = useState("");
  const [currentSubCategories, setCurrentSubCategories] = useState([]);
  const [currentIconName, setCurrentIconName] = useState("mdiAccount");
  const categories = filteredCategories
    ? filteredCategories
    : Object.keys(categoriesJS).map((categoryName) => ({
        name: categoryName,
        subcategories: categoriesJS[categoryName].subcategories,
      }));
  const [selectedCategories, setSelectedCategories] = useState([]);

  const toggleCategorySelection = (categoryName) => {
    let subCategoryQuantity = categories.find((cat) => cat.name === categoryName).subcategories
      .length;

    if (subCategoryQuantity === 0) {
      let filteredSelectedCategories = selectedCategories.filter(
        (category) => category !== categoryName
      );
      setSelectedCategories((prev) =>
        prev.includes(categoryName) ? filteredSelectedCategories : [...prev, categoryName]
      );
    } else {
      setSelectedCategories((prev) => [...prev, categoryName]);
    }
  };
  useEffect(() => {
    if (currentSubCategories.length > 0) {
      onChange("", selectedCategories);
    } else {
      onChange(currentCategory, selectedCategories);
    }
  }, [currentCategory, selectedCategories, currentSubCategories.length]);

  console.log( "42 selectedCategories", selectedCategories );
  
  const handleCategoryClick = ( category ) => {
    if ( selectedCategories.length > 3 && !selectedCategories.includes(category.name)) {
      toast.warn("You can select up to 3 subcategories");
      return;
    }
    if (category.subcategories.length === 0 && category.name !== "Other") {
      setCurrentSubCategories(category.name);
      toggleCategorySelection(category.name);
    } else {
      setOpenModal(true);
      setCurrentCategory(category.name);
      setCurrentSubCategories(category.subcategories);
      setCurrentIconName(category?.iconName);
      toggleCategorySelection(category.name);
    }
  };
  return (
    <>
      <div className='scroll-wrapper'>
        <div className='mtb-category-selector'>
          {categories.map((category, idx) => (
            <MTBCategorySelectItem
              key={idx}
              onClick={() => handleCategoryClick(category)}
              category={category.name}
              subCategories={category.subcategories}
              iconName={category?.iconName}
              clicked={selectedCategories.includes(category.name)}
            />
          ))}
        </div>
      </div>
      <MTBModal
        onSubCategoriesChange={setSelectedCategories}
        iconName={currentIconName}
        subcategories={currentSubCategories}
        isOther={currentCategory === "Other"}
        category={currentCategory}
        isOpen={openModal}
        onClose={() => setOpenModal(false)}
      />
    </>
  );
};

export default MTBCategorySelector;
