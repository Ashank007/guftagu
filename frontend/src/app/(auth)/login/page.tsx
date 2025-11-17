'use client';

import { useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { FaLinkedin, FaGithub } from "react-icons/fa";
import Link from 'next/link';
import { AtSymbolIcon, LockClosedIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        const loadingToastId = toast.loading('Logging in...');
        try {
            const res = await api.post('/auth/login', { email, password });
            login(res.data);
            toast.dismiss(loadingToastId);
            toast.success('Login Successful! Welcome back.');
            router.push('/chat');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Login failed');
            toast.dismiss(loadingToastId);
            toast.error('Login Failed!');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">

            <h1 className="text-5xl sm:text-6xl font-bold mb-8 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 drop-shadow-[0_2px_4px_rgba(128,90,213,0.5)]">
                Guftagu
            </h1>

            <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 border border-gray-700">
                <h2 className="text-2xl font-semibold text-gray-100 mb-6 text-center">Login to Your Account</h2>

                {error && (
                    <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-lg text-center mb-6 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-300">Email</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                                <AtSymbolIcon className="h-5 w-5 text-gray-400" />
                            </span>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full pl-10 pr-4 py-3 bg-gray-700 rounded-lg text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="username@mietjammu.in"
                            />
                        </div>
                    </div>

                    {/* --- Password Block Start (Corrected) --- */}
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
                        {/* Forgot Password Link Below Input */}
                        <div className="text-right mt-1">
                            <Link href="/forgot-password" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors duration-200">
                                Forgot Password?
                            </Link>
                        </div>
                    </div>
                    {/* --- Password Block End (Corrected) --- */}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 font-semibold tracking-wide bg-blue-600 hover:bg-blue-700 rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 disabled:transform-none disabled:shadow-none disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                <p className="text-center mt-6 pt-6 border-t border-gray-700 text-sm text-gray-400">
                    Don&apos;t have an account?{' '}
                    <Link href="/register" className="text-blue-400 hover:text-blue-300 transition-colors duration-200 font-medium">
                        Register
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