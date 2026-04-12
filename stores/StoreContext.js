"use client"
import React, { useContext } from "react";
import rootStore from "./RootStore";

export const StoreContext = React.createContext(rootStore);

export const StoreProvider = ({ children }) => (
  <StoreContext.Provider value={rootStore}>
    {children}
  </StoreContext.Provider>
);

export const useStore = () => {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return store;
};
