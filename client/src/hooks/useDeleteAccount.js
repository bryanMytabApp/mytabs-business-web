import { toast } from "react-toastify";
import { deleteCognitoUser } from "../services/userService";
import { useCallback, useState } from "react";
import { loginMobile } from "../services/authService";
import { getUserIdCognito } from "../utils/common";

const useDeleteAccount = () => {
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleInputChange = useCallback((value, name) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prevErrors) => ({...prevErrors, [name]: undefined}));

  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
  
    const { email, password } = formData;
  
    try {
      const sessionData = await loginMobile({ username: email.trim(), password });
      localStorage.setItem("refToken", sessionData.RefreshToken);
      localStorage.setItem("idToken", sessionData.IdToken);

      if (sessionData) {
        const userIdCognito = await getUserIdCognito(sessionData.IdToken);
        const response = await deleteCognitoUser(userIdCognito);
  
        if (response.status === 200) {
          toast.success('User successfully deleted');
          setFormData({ email: "", password: "" });
        }
      }
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return {
    errors,
    formData,
    isLoading,
    handleSubmit,
    handleInputChange,
  }
}

export default useDeleteAccount;