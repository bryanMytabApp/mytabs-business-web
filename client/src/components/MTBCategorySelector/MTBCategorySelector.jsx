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
        isText: false,
      }));
  // console.log("Categoriessss",categoriesJS)
  const [selectedCategories, setSelectedCategories] = useState([]);

  const toggleCategorySelection = (categoryName) => {
    let subCategoryQuantity = categories.find((cat) => cat.name === categoryName).subcategories
      .length;

    if (subCategoryQuantity === 0) {
      let filteredSelectedCategories = Array.from(
        new Set(selectedCategories.filter((category) => category.name !== categoryName))
      );
      // [{
      //   name: "Other",
      //   subcategories: ["Other"],
      //   subcategoryText: "",
      
    // },
      //   name: "Restaurant",
      //   subcategories: ["a", "b", "c"],
      //   subCategoryText: "",
      // }
    // ]
      
      //subcategories.length =  0 : return name
      // else find in subcategories


      // const categoryFinder = ( categoryList, categoryName ) => {
      //   categoryList.forEach( category => {
      //     if ( !category.subCategories.length ) {
            
      //     }
      //   })
      //   if ( categoryList.find( ( category ) => category.name === categoryName ) ) {
      //     return categoryList.find( ( category ) => category.name === categoryName )
      //   } else {
      //     cacategoryList
      //   }
      //  }
      setSelectedCategories((prev) =>
        prev.includes(categoryName)
          ? filteredSelectedCategories
          : Array.from(new Set([...prev, categoryName]))
      );
    }
  };
  useEffect(() => {
    // console.log("data", data.subcategory);
    // console.log();
    if (currentSubCategories.length > 0) {
      onChange("", selectedCategories);
    } else {
      onChange(currentCategory, selectedCategories);
    }
  }, [currentCategory, selectedCategories, currentSubCategories.length]);

  const handleCategoryClick = ( category ) => {
    console.log('[handleCategoryClick ] category', category)
    console.log("selectedCategoriessdssds", selectedCategories);
    if (data.subcategory.length > 3 && !selectedCategories.includes(category.name)) {
      toast.warn("You can select up to 3 subcategories");
      return;
    }
    if (category.subcategories.length === 0 && category.name !== "Other") {
      setCurrentSubCategories(category.subcategories);
      setCurrentCategory(category);
      toggleCategorySelection(category.name);
    } else {
      setOpenModal(true);
      setCurrentCategory(category);
      setCurrentSubCategories([category]);
      setCurrentIconName(category?.iconName);
    }
  };

  const categoryContainsSubCategory = (categoryName, dataArr) => {
    const currCategory = categories.find(
      (category) => category.name === categoryName
    ).subcategories;

    return typeof dataArr == "string"
      ? [dataArr].length && [dataArr]?.some((el) => currCategory.includes(el))
      : [...dataArr].length && [...dataArr]?.some((el) => currCategory.includes(el));
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
              clicked={
                selectedCategories.includes( category.name )
                // ||
                // categoryContainsSubCategory(category.name, data.subcategory)
              }
            />
          ))}
        </div>
      </div>
      <MTBModal
        data={data}
        onSubCategoriesChange={setSelectedCategories}
        iconName={currentIconName}
        currentCategoryObj={currentSubCategories}
        isOther={currentCategory === "Other"}
        category={currentCategory}
        isOpen={openModal}
        onClose={() => setOpenModal(false)}
      />
    </>
  );
};

export default MTBCategorySelector;
