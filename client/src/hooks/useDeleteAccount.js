import { toast } from "react-toastify";
import { deleteUserAccount } from "../services/userService";
import { useCallback, useState } from "react";
import { getToken } from "../services/authService";

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
    try {
      setIsLoading(true);
      const { email, password } = formData;
      const res = await getToken({ username: email.trim(), password });
      console.log('res: ', res)
      const encodedEmail = encodeURIComponent(email);
      await deleteUserAccount(encodedEmail);
    } catch (error) {
      toast.error("Something went wrong");
    }
    setIsLoading(false)
  }

  return {
    errors,
    formData,
    isLoading,
    handleSubmit,
    handleInputChange,
  }
}

export default useDeleteAccount;