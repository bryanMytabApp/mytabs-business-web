import React from "react";
import ReactLoading from "react-loading";

import "./MTBLoading.css";

export default function MTBLoading({width = 60, height = 60, color = "#00AAD6"}) {
  return (
    <div className='MTB-loading'>
      <ReactLoading type='spin' width={width} height={height} color={color} />
    </div>
  );
}
