"use client";

import { useAuthPayment } from "@/context/AuthPaymentContext";
import { X, Check } from "lucide-react";

const plans = [
  {
    id: "1-month",
    name: "1 Month",
    price: "299",
    duration: "month",
    features: ["Unlimited PDF Downloads", "All Pro Tools", "No Watermark", "Email Support"]
  },
  {
    id: "3-months",
    name: "3 Months",
    price: "699",
    duration: "3 months",
    popular: true,
    features: ["Unlimited PDF Downloads", "All Pro Tools", "No Watermark", "Priority Support"]
  },
  {
    id: "6-months",
    name: "6 Months",
    price: "999",
    duration: "6 months",
    features: ["Unlimited PDF Downloads", "All Pro Tools", "No Watermark", "24/7 Phone Support"]
  }
];

export default function PricingModal() {
  const { showPaymentModal, setShowPaymentModal, subscribe } = useAuthPayment();

  if (!showPaymentModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-5xl rounded-3xl shadow-2xl relative my-8 animate-in fade-in zoom-in-95 duration-200">
        <button 
          onClick={() => setShowPaymentModal(false)}
          className="absolute right-6 top-6 text-zinc-400 hover:text-white transition-colors bg-zinc-800 rounded-full p-2"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="p-8 md:p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Upgrade to Premium</h2>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto mb-10">
            You need an active subscription to download edited PDFs. Choose a plan that works best for you and unlock all features.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto text-left">
            {plans.map((plan) => (
              <div 
                key={plan.id} 
                className={`relative flex flex-col bg-zinc-800/50 border rounded-2xl p-6 md:p-8 transition-transform hover:scale-105 ${
                  plan.popular ? "border-blue-500 shadow-xl shadow-blue-500/10" : "border-zinc-700"
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white text-xs font-bold uppercase tracking-widest py-1 px-3 rounded-full">
                    Most Popular
                  </div>
                )}
                
                <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                <div className="my-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">₹{plan.price}</span>
                  <span className="text-zinc-400">/{plan.duration}</span>
                </div>
                
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-zinc-300">
                      <Check className="w-5 h-5 text-blue-400 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <button 
                  onClick={subscribe}
                  className={`w-full py-3 px-6 rounded-xl font-semibold transition-all ${
                    plan.popular 
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20" 
                      : "bg-white hover:bg-zinc-200 text-zinc-900"
                  }`}
                >
                  Choose {plan.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
