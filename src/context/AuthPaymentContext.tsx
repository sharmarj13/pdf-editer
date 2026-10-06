"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface AuthPaymentContextType {
  isAuthenticated: boolean;
  hasSubscription: boolean;
  login: () => void;
  logout: () => void;
  subscribe: () => void;
  showPaymentModal: boolean;
  setShowPaymentModal: (show: boolean) => void;
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
}

const AuthPaymentContext = createContext<AuthPaymentContextType | undefined>(undefined);

export function AuthPaymentProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const login = () => {
    setIsAuthenticated(true);
    setShowLoginModal(false);
  };

  const logout = () => {
    setIsAuthenticated(false);
    setHasSubscription(false);
  };

  const subscribe = () => {
    setHasSubscription(true);
    setShowPaymentModal(false);
  };

  return (
    <AuthPaymentContext.Provider
      value={{
        isAuthenticated,
        hasSubscription,
        login,
        logout,
        subscribe,
        showPaymentModal,
        setShowPaymentModal,
        showLoginModal,
        setShowLoginModal,
      }}
    >
      {children}
    </AuthPaymentContext.Provider>
  );
}

export function useAuthPayment() {
  const context = useContext(AuthPaymentContext);
  if (context === undefined) {
    throw new Error("useAuthPayment must be used within an AuthPaymentProvider");
  }
  return context;
}
