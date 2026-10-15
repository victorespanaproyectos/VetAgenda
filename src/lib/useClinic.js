import { createContext, useContext } from "react";
export const ClinicContext = createContext(null);
export function useClinic() {
  return useContext(ClinicContext);
}
