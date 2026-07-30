import React, { createContext, useContext } from 'react';
import { SERVICES } from '../data/services';

const ServicesContext = createContext(SERVICES);

export function ServicesProvider({ children }) {
  return (
    <ServicesContext.Provider value={SERVICES}>
      {children}
    </ServicesContext.Provider>
  );
}

export function useServices() {
  return useContext(ServicesContext);
}
