import { createContext, useContext } from "react";

export const AccountLoadingContext = createContext<{ ready: boolean; error: boolean; retry: () => void; attempt: number } | null>(null);
export const useBackgroundAccount = () => useContext(AccountLoadingContext);
