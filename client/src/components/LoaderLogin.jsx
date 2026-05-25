import { redirect } from "react-router-dom";
import { getCookie } from "../../utils/Tools.ts";

export const LoaderLogin = () => {
  const isLoggedIn = getCookie("token") !== null;

  if (isLoggedIn) {
    let paymentData = {
      price: 13.99,
      plan: "Basic",
    };

    localStorage.setItem("checkoutResult", JSON.stringify(paymentData));

    return redirect("/admin");
  }

  return null;
};