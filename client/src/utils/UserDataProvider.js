import React, {createContext, useEffect, useState} from "react";
import {toast} from "react-toastify";


import {MTBLoading} from "../components";

const UserDataContext = createContext(null);

const UserDataProvider = ({children}) => {
  const [user, setUser] = useState({});
  const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsLoading(false)
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, []); 
  

  if (isLoading) {
    return <MTBLoading />;
  }

  return <UserDataContext.Provider value={{user}}>{children}</UserDataContext.Provider>;
};

export {UserDataProvider, UserDataContext};
