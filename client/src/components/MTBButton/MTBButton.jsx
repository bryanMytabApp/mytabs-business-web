import React from "react";
import ReactLoading from "react-loading";
import "./MTBButton.css";
export default function MTBButton({
  children = "",
  disabled = false,
  secondary = false,
  onClick = () => {},
  isLoading = false,
  style = {},
  image = null,
  icon = null,
  override = false,
  outlined = false,
  hasOwnClassName = false,
  ownClassName = {},
}) {
  let classes = "MTB-button";
  if (secondary) {
    classes += " secondary";
  }

  const imageNewStyles = {
    backgroundSize: "cover",
    backgroundPosition: "center",
    padding: "10px 20px",
    height: 72,
    width: 72,
    marginRight: 10,
    borderRadius: 100,
  };

  const imageDefaultStyles = {
    height: 72,
    width: 72,
    backgroundColor: "#F5EAEC",
    marginRight: 10,
    borderRadius: 100,
  };

  return image ? (
    <button
      className={!hasOwnClassName ? classes : ownClassName}
      style={{
        ...style,
        backgroundImage: image ? `url(${image})` : null,
        ...imageNewStyles,
      }}
      disabled={disabled || isLoading}
      onClick={onClick}>
      {isLoading ? <ReactLoading type='spin' height={36} width={36} color='#00AAD6' /> : children}
    </button>
  ) : (
    <button
      className={!hasOwnClassName ? classes : ownClassName}
      style={{...style}}
      disabled={disabled || isLoading}
      onClick={onClick}>
      {isLoading ? <ReactLoading type='spin' height={24} width={24} color='#00AAD6' /> : children}
    </button>
  );
}
