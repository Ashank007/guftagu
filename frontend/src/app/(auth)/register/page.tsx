'use client';
import toast from 'react-hot-toast';
import { useState } from 'react';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { FaLinkedin, FaGithub } from "react-icons/fa";
import Link from 'next/link';
import {
    AtSymbolIcon,
    LockClosedIcon,
    UserIcon,
    KeyIcon,
    EyeIcon,
    EyeSlashIcon,
} from '@heroicons/react/24/outline';

export default function RegisterPage() {
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [fullName, setFullName] = useState('');
    const [year, setYear] = useState('1st');
    const [sex, setSex] = useState('Male');
    const [error, setError] = useState('');
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const router = useRouter();
    const { login } = useAuth();

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSendingOtp(true);
        const loadingToastId = toast.loading('Sending OTP...');
        try {
            await api.post('/auth/send-otp', { email });
            toast.dismiss(loadingToastId);
            toast.success('OTP Sent! Check your email.');
            setStep(2);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to send OTP');
            toast.dismiss(loadingToastId);  
            toast.error(err.response?.data?.message);  
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsRegistering(true);
        const loadingToastId = toast.loading('Creating account...');
        try {
            const res = await api.post('/auth/register', {
                email,
                otp,
                password,
                fullName,
                year,
                sex,
            });
            login(res.data);
            toast.dismiss(loadingToastId);  
            toast.success('Registration Successful! Welcome!');  
            router.push('/chat');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Registration failed');
            toast.dismiss(loadingToastId);  
            toast.error(err.response?.data?.message);  
        } finally {
            setIsRegistering(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">
            
            <h1 className="text-5xl sm:text-6xl font-bold mb-8 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 drop-shadow-[0_2px_4px_rgba(128,90,213,0.5)]">
                Guftagu
            </h1>

            <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 border border-gray-700">
                {error && (
                    <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-lg text-center mb-6 text-sm">
                        {error}
                    </div>
                )}

                {step === 1 && (
                    <form onSubmit={handleSendOtp} className="space-y-6">
                        <h2 className="text-2xl font-semibold text-gray-100 mb-6 text-center">Create Your Account</h2>
                        <div>
                            <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-300">College Email</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                                    <AtSymbolIcon className="h-5 w-5 text-gray-400" />
                                </span>
                                <input
                                    type="email"
                                    id="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="username@mietjammu.in"
                                    required
                                    className="w-full pl-10 pr-4 py-3 bg-gray-700 rounded-lg text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>
                        <button 
                            type="submit" 
                            disabled={isSendingOtp}
                            className="w-full py-3 font-semibold tracking-wide bg-blue-600 hover:bg-blue-700 rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:transform-none disabled:shadow-none disabled:cursor-not-allowed"
                        >
                            {isSendingOtp ? 'Sending...' : 'Send OTP'}
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <h2 className="text-2xl font-semibold text-gray-100 mb-6 text-center">Verify & Complete Profile</h2>
                        
                        <div>
                            <label htmlFor="email-disabled" className="block mb-2 text-sm font-medium text-gray-300">Email</label>
                            <input 
                                type="text" 
                                id="email-disabled"
                                value={email} 
                                disabled 
                                className="w-full px-4 py-3 bg-gray-900 text-gray-400 rounded-lg border border-gray-700 cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label htmlFor="otp" className="block mb-2 text-sm font-medium text-gray-300">OTP Code</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                                    <KeyIcon className="h-5 w-5 text-gray-400" />
                                </span>
                                <input
                                    type="text"
                                    id="otp"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    placeholder="Enter 6-digit OTP"
                                    required
                                    className="w-full pl-10 pr-4 py-3 bg-gray-700 rounded-lg text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-300">Password</label>
                             <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                                    <LockClosedIcon className="h-5 w-5 text-gray-400" />
                                </span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    id="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full pl-10 pr-12 py-3 bg-gray-700 rounded-lg text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-200"
                                >
                                    {showPassword ? (
                                        <EyeSlashIcon className="h-5 w-5" />
                                    ) : (
                                        <EyeIcon className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>
                        
                        <div>
                            <label htmlFor="fullName" className="block mb-2 text-sm font-medium text-gray-300">Full Name</label>
                            <div className="relative">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                                    <UserIcon className="h-5 w-5 text-gray-400" />
                                </span>
                                <input
                                    type="text"
                                    id="fullName"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Your Full Name"
                                    required
                                    className="w-full pl-10 pr-4 py-3 bg-gray-700 rounded-lg text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>
                        
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label htmlFor="year" className="block mb-2 text-sm font-medium text-gray-300">Year</label>
                                <select id="year" value={year} onChange={(e) => setYear(e.target.value)} className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
                                    <option value="1st">1st Year</option>
                                    <option value="2nd">2nd Year</option>
                                    <option value="3rd">3rd Year</option>
                                    <option value="4th">4th Year</option>
                                </select>
                            </div>
                            <div className="flex-1">
                                <label htmlFor="sex" className="block mb-2 text-sm font-medium text-gray-300">Gender</label>
                                <select id="sex" value={sex} onChange={(e) => setSex(e.target.value)} className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all">
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>
                        
                        <button 
                            type="submit" 
                            disabled={isRegistering}
                            className="w-full py-3 font-semibold tracking-wide bg-green-600 hover:bg-green-700 rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg hover:shadow-green-500/50 disabled:opacity-50 disabled:transform-none disabled:shadow-none disabled:cursor-not-allowed"
                        >
                            {isRegistering ? 'Registering...' : 'Create Account'}
                        </button>

                        <button 
                            type="button" 
                            onClick={() => { setStep(1); setError(''); }}
                            className="w-full py-2 text-gray-400 hover:text-white transition-colors"
                        >
                            &larr; Back to Email
                        </button>
                    </form>
                )}

                <p className="text-center mt-6 pt-6 border-t border-gray-700 text-sm text-gray-400">
                    Already have an account?{' '}
                    <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors duration-200 font-medium">
                        Login
                    </Link>
                </p>
                {/* ✅ STICKY FOOTER (Always visible) */}
                <footer className="fixed bottom-0 left-0 w-full bg-blue-300 backdrop-blur-md border-t border-white/50 py-3 shadow-sm">
                  <div className="flex flex-col items-center justify-center gap-1 text-center">
                    <p className="text-gray-800 font-semibold text-sm">
                      Created by <span className="text-blue-600 font-bold">Ashank Gupta</span>
                    </p>
                    <div className="flex justify-center gap-4">
                      <a
                        href="https://www.linkedin.com/in/ashank-gupta-tech"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 hover:scale-110 transition-transform"
                      >
                        <FaLinkedin size={22} />
                      </a>
                      <a
                        href="https://github.com/ashank007"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-800 hover:scale-110 transition-transform"
                      >
                        <FaGithub size={22} />
                      </a>
                    </div>
                  </div>
                </footer>
 
            </div>
        </div>
    );
}