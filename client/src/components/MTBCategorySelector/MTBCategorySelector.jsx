import React, {useEffect, useState} from "react";
import MTBCategorySelectItem from "./MTBCategorySelectItem";
import "./MTBCategorySelector.css";
import MTBModal from "../MTBModal/MTBModal";
import categoriesJS from "../../utils/data/categories";
import {toast} from "react-toastify";
let categories;
const MTBCategorySelector = ({onChange = () => {}, data, filteredCategories}) => {
  const [openModal, setOpenModal] = useState(false);
  const [currentCategory, setCurrentCategory] = useState("");
  const [currentIconName, setCurrentIconName] = useState("mdiAccount");
  const [testCategories, setTestCategories] = useState([]);

  // const categories = filteredCategories ? filteredCategories : categoriesJS;
  useEffect(() => {
    categories = filteredCategories ? filteredCategories : categoriesJS;
  },[])

  useEffect(() => {
    if ( testCategories.length > 0 ) {
      const _testCategories = JSON.parse(JSON.stringify(testCategories));
      onChange(_testCategories);
    } 
  }, [currentCategory, testCategories.length]);

  const handleCategoryClick = (category) => {

    if (testCategories.some((cat) => cat.name === category.name)) {
      const _testCategories = testCategories.filter((cat) => cat.name !== category.name);
      setTestCategories(_testCategories);
      return;
    }
    if (testCategories.length > 2) {
      toast.warn("You can only select up to 3 categories");
      return;
    }
    if (category.subcategories.length > 0) {
      setOpenModal(true);
      setCurrentCategory(category);
    } else {
      setTestCategories((prev) => [...prev, category]);
    }
  };

  return (
    <>
      <div className='scroll-wrapper'>
        
        <div className='mtb-category-selector'>
          {categories && categories.length && categories.map((category, idx) => (
            <MTBCategorySelectItem
              key={idx}
              onClick={() => handleCategoryClick(category)}
              category={category.name}
              subCategories={category.subcategories}
              iconName={category?.iconName}
              clicked={testCategories.some((cat) => cat.name === category.name)}
              testCategories={testCategories}
            />
          ))}
        </div>
      </div>
      <MTBModal
        data={data}
        onSubCategoriesChange={(arg) => setTestCategories((prev) => [...prev, arg])}
        iconName={currentIconName}
        currentCategoryObj={currentCategory}
        isOther={currentCategory.name === "Other"}
        category={currentCategory}
        isOpen={openModal}
        onClose={() => setOpenModal(false)}
      />
    </>
  );
};

export default MTBCategorySelector;
