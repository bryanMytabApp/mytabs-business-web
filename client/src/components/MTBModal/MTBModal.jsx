import React from "react";
import "./MTBModal.css";
import MTBButton from "../MTBButton/MTBButton";
import MTBInput from "../MTBInput/MTBInput";

const MTBModal = ({isOpen, onClose, children, category}) => {
  if (!isOpen) return null;

  return (
    <div className='MTB-modal-overlay' onClick={onClose}>
      <div className='MTB-modal-content' onClick={(e) => e.stopPropagation()}>
        <div className='MTB-modal-first'>
          <div className=''>category icon</div>
          <div>Category variable</div>
        </div>
        <div className='MTB-modal-second'>
          <div>Type the subcategory option</div>
          <MTBInput placeholder="Type your category" />
        </div>
        <div className='MTB-modal-third'>
          <MTBButton onClick={onClose}>Close</MTBButton>
        </div>
      </div>
    </div>
  );
};

export default MTBModal;
