"use client";

import { createContext, useContext } from "react";

type HostAuthUser = { id: string; email: string };

const HostAuthUserContext = createContext<HostAuthUser | null>(null);

export function HostAuthProvider({
  user,
  children,
}: {
  user: HostAuthUser;
  children: React.ReactNode;
}) {
  return (
    <HostAuthUserContext.Provider value={user}>
      {children}
    </HostAuthUserContext.Provider>
  );
}

export function useHostAuthUser() {
  const value = useContext(HostAuthUserContext);
  if (!value) {
    throw new Error("useHostAuthUser must be used within HostAuthProvider");
  }
  return value;
}

