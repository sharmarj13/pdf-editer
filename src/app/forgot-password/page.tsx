import Link from "next/link";
import { Mail, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
      
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-2xl shadow-2xl relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="p-8">
          <Link href="/login" className="inline-flex items-center text-xs text-zinc-400 hover:text-white transition-colors mb-6 group">
            <ArrowLeft className="w-4 h-4 mr-1 group-hover:-translate-x-1 transition-transform" /> Back to Login
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Reset Password</h1>
            <p className="text-zinc-400 text-sm">Enter your email address and we'll send you a link to reset your password.</p>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Email</label>
              <div className="relative group">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
                <input 
                  type="email" 
                  placeholder="you@example.com" 
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>
            
            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 mt-2">
              Send Reset Link
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
