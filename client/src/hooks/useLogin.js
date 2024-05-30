import { useState } from "react";
import { toast } from "react-toastify";
import { useNavigate} from "react-router-dom";
import { getToken } from "../services/authService";
import { getCustomerSubscription } from "../services/paymentService";
import { parseJwt } from "../utils/common";


const useLogin = () => {
  const navigate = useNavigate();
  const [invalid, setInvalid] = useState({});
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const goToPasswordRecovery = () => {
    navigate("/password-recovery");
  };

  const handleUsername = (value) => {
    if (invalid.username) {
      setInvalid({ ...invalid, username: undefined });
    }
    setUsername(value);
  };

  const handlePassword = (value) => {
    if (invalid.password) {
      setInvalid({ ...invalid, password: undefined });
    }
    setPassword(value);
  };

  const handleLogin = async () => {
    if (isLoading) {
      return;
    }

    const _invalid = {
      username: username.trim() ? undefined : "Please enter your email or username",
      password: password ? undefined : "Please enter your password",
    };

    if (_invalid.username || _invalid.password) {
      return setInvalid(_invalid);
    }

    try {
      setIsLoading(true);
      let res = await getToken({ username: username.trim(), password: password });

      localStorage.setItem("refToken", res.RefreshToken);
      localStorage.setItem("idToken", res.IdToken);
      toast.success("Welcome!");

      let userId = parseJwt(res.IdToken);

      let customerSub;
      try {
        customerSub = await getCustomerSubscription({ userId });
      } catch (error) {
        console.warn("Failed to fetch customer subscription:", error);
        customerSub = null; // Handle missing subscription
      }

      if (customerSub) {
        if (+customerSub.data.currentPeriodEnd > new Date().getTime() / 1000) {
          navigate("/admin/dashboards");
        } else {
          navigate("/subscription");
        }
      } else {
        navigate("/subscription");
      }
    } catch (error) {
      toast.error("Invalid user and/or password");
      console.error("Login failed:", error);
      setIsLoading(false);
    }
  };

  const handleSignUp = () => {
    navigate("/register");
  };

  return {
    username,
    password,
    invalid,
    isLoading,
    goToPasswordRecovery,
    handleUsername,
    handlePassword,
    handleLogin,
    handleSignUp,
  };
};

export default useLogin;