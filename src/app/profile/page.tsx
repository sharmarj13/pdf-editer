"use client";

import Link from "next/link";
import { ArrowLeft, User, Mail, CreditCard, Shield, LogOut } from "lucide-react";
import { useAuthPayment } from "@/context/AuthPaymentContext";

export default function ProfilePage() {
  const { hasSubscription, logout } = useAuthPayment();

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center p-4 md:p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      
      <div className="w-full max-w-4xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Link href="/" className="inline-flex items-center text-sm text-neutral-500 hover:text-neutral-900 transition-colors mb-6 group">
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Editor
        </Link>

        <h1 className="text-3xl font-bold text-neutral-900 mb-8 tracking-tight">Account Settings</h1>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Profile Details */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white border border-neutral-100 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 border-b border-neutral-100 flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center border border-blue-500/30">
                  <User className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-neutral-900">John Doe</h2>
                  <p className="text-neutral-500 text-sm">demo@example.com</p>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-widest mb-4">Edit Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500">First Name</label>
                    <input type="text" defaultValue="John" className="w-full bg-neutral-100 border border-neutral-200 rounded-xl p-2.5 text-neutral-900 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-500">Last Name</label>
                    <input type="text" defaultValue="Doe" className="w-full bg-neutral-100 border border-neutral-200 rounded-xl p-2.5 text-neutral-900 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500">Email Address</label>
                  <input type="email" defaultValue="demo@example.com" disabled className="w-full bg-neutral-100/50 border border-neutral-200/50 rounded-xl p-2.5 text-neutral-400 cursor-not-allowed" />
                </div>
                <div className="pt-2">
                  <button className="bg-blue-600 hover:bg-blue-500 text-neutral-900 font-medium py-2 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/20">
                    Save Changes
                  </button>
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="bg-white border border-neutral-100 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 border-b border-neutral-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-bold text-neutral-900">Change Password</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500">Current Password</label>
                  <input type="password" placeholder="••••••••" className="w-full bg-neutral-100 border border-neutral-200 rounded-xl p-2.5 text-neutral-900 focus:outline-none focus:ring-1 focus:ring-purple-500" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-500">New Password</label>
                  <input type="password" placeholder="••••••••" className="w-full bg-neutral-100 border border-neutral-200 rounded-xl p-2.5 text-neutral-900 focus:outline-none focus:ring-1 focus:ring-purple-500" />
                </div>
                <div className="pt-2">
                  <button className="bg-purple-600 hover:bg-purple-500 text-neutral-900 font-medium py-2 px-6 rounded-xl transition-all shadow-lg shadow-purple-500/20">
                    Update Password
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar / Subscription Info */}
          <div className="space-y-6">
            <div className="bg-white border border-neutral-100 rounded-2xl shadow-xl overflow-hidden">
              <div className="p-6 border-b border-neutral-100 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-green-400" />
                <h2 className="text-lg font-bold text-neutral-900">Subscription</h2>
              </div>
              <div className="p-6">
                {hasSubscription ? (
                  <div className="space-y-4">
                    <div className="inline-block px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-bold uppercase tracking-widest">
                      Active
                    </div>
                    <p className="text-neutral-900 font-medium text-lg">Pro Plan (6 Months)</p>
                    <p className="text-neutral-500 text-sm border-b border-neutral-100 pb-4">Renews on Oct 6, 2027</p>
                    <button className="w-full bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-medium py-2 rounded-xl transition-all text-sm">
                      Manage Billing
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 text-center">
                    <div className="inline-block px-3 py-1 bg-neutral-100 text-neutral-500 rounded-full text-xs font-bold uppercase tracking-widest">
                      Free Plan
                    </div>
                    <p className="text-neutral-500 text-sm">You are currently on the free tier. Upgrade to download edited PDFs.</p>
                    <button className="w-full bg-blue-600 hover:bg-blue-500 text-neutral-900 font-medium py-2 rounded-xl transition-all shadow-lg shadow-blue-500/20 text-sm">
                      View Plans
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button 
              onClick={logout}
              className="w-full bg-white border border-neutral-100 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 text-neutral-500 font-medium py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl"
            >
              <LogOut className="w-5 h-5" /> Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
