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

  useEffect(() => {
    if (currentSubCategories.length > 0) {
      onChange("", selectedCategories);
    } else {
      onChange(currentCategory, selectedCategories);
    }
  }, [currentCategory, selectedCategories, currentSubCategories.length]);

  const toggleCategorySelection = (categoryName) => {
    console.log("categoryName", categoryName);
    console.log("selectedCategories", selectedCategories);

    let subCategoryQuantity = categories.find((cat) => cat.name === categoryName).subcategories
      .length;

    if (subCategoryQuantity !== 0) {
      return;
    }
    setSelectedCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((category) => category !== categoryName)
        : [...prev, categoryName]
    );
  };

  const handleCategoryClick = (category) => {
    console.log("handle Category cate", category);
    if (category.subcategories.length === 0 && category.name !== "Other") {
      setCurrentSubCategories(category.name);
      toggleCategorySelection(category.name);
    } else {
      if (selectedCategories.length > 3) {
        toast.warn("You can select up to 3 subcategories");
      }
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
