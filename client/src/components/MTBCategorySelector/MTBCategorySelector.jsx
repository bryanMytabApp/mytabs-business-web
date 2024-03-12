import React, {useEffect, useState} from "react";
import MTBCategorySelectItem from "./MTBCategorySelectItem";
import "./MTBCategorySelector.css";
import MTBModal from "../MTBModal/MTBModal";
import categories from "../../utils/data/categories.json";
const MTBCategorySelector = ({}) => {
  const [openModal, setOpenModal] = useState(false);
   const categories = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"];
  useEffect(() => {
    // Object.keys(categories).forEach((key) => {
    //   console.log(key);
    //   categories[key].forEach((item) => {
    //     console.log(item);
    //   });
    // });
  }, []);

  return (
    <>
      <div className='mtb-category-selector'>
        {categories.map((category, idx) => {
          return (
            <MTBCategorySelectItem
              key={idx}
              onClick={() => setOpenModal(true)}
              category={category}
            />
          );
        })}
      </div>
      <MTBModal isOpen={openModal} onClose={() => setOpenModal(false)}>
        <p>sub category</p>
      </MTBModal>
    </>
  );
};

export default MTBCategorySelector;
