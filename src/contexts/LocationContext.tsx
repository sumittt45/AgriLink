import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface LocationContextType {
  city: string;
  state: string;
  hasLocation: boolean;
  /** Update both city and state, persists to localStorage */
  setLocation: (state: string, city: string) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<string>(() => localStorage.getItem("state") || "");
  const [city, setCity]   = useState<string>(() => localStorage.getItem("city")  || "");

  const setLocation = useCallback((newState: string, newCity: string) => {
    localStorage.setItem("state", newState);
    localStorage.setItem("city",  newCity);
    setState(newState);
    setCity(newCity);
  }, []);

  return (
    <LocationContext.Provider
      value={{ city, state, hasLocation: !!(city || state), setLocation }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useAppLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("useAppLocation must be used within LocationProvider");
  return ctx;
}
