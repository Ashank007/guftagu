'use client';

import { useState, ChangeEvent, FormEvent, useEffect } from 'react'; 
import toast from 'react-hot-toast';
import { FaLinkedin, FaGithub } from "react-icons/fa";
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import axios from 'axios'; 

export default function ProfilePage() {
    const { user, login, loading, isAuthenticated } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (user && !file && user.profilePicture) {
           if (user.profilePicture !== 'default_avatar_url' && user.profilePicture !== '/default-avatar.png') {
                 setFilePreview(user.profilePicture);
           } else {
               setFilePreview(null);  
           }
        }
    }, [user, file]);
    if (loading) return <div className="text-center p-10">Loading...</div>;
    if (!isAuthenticated) {
        router.push('/login');
        return null;
    }

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setFilePreview(URL.createObjectURL(selectedFile));
            setError('');  
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!file) {
            toast.error('Please select a file first.');
            return;
        }

        setError('');
        setIsUploading(true);
        const loadingToastId = toast.loading('Uploading picture...');

        const formData = new FormData();
        formData.append('profilePicture', file);

        try {
            const res = await api.put('/users/profile', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            login(res.data);
            setFilePreview(res.data.profilePicture);
            setFile(null);  
            setIsUploading(false);
            toast.dismiss(loadingToastId);  
            toast.success('Profile picture updated!');  
            router.push('/chat');

        } catch (err: unknown) {  
          let message = 'Upload failed. Check server logs.';
            if (err instanceof Error) {
                if (axios.isAxiosError(err) && err.response) {
                    message = err.response.data?.message || err.message;
                } else {
                    message = err.message;
                }
            }
            setError(message);
            toast.dismiss(loadingToastId);  
            toast.error(message);  
            setIsUploading(false);
        }
    };

    const imageSrc = filePreview || user?.profilePicture || '/default-avatar.png';
    const displaySrc = (imageSrc === 'default_avatar_url') ? '/default-avatar.png' : imageSrc;


    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">
            
            {/* --- Main Profile Card --- */}
            <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 border border-gray-700 relative mb-24"> {/* Added mb-24 to prevent overlap with footer */}
                
                {/* Back Button */}
                <button 
                    onClick={() => router.back()} 
                    className="absolute top-4 left-4 text-blue-400 hover:text-blue-300 transition-colors text-sm"
                >
                    &larr; Back
                </button>

                <h1 className="text-2xl font-semibold text-center mb-6 pt-6 text-gray-100">Your Profile</h1>
                
                <div className="flex justify-center mb-6">
                    <Image
                        src={displaySrc}
                        alt="Profile Picture"
                        width={150}
                        height={150}
                        className="rounded-full object-cover w-[150px] h-[150px] border-4 border-gray-600 shadow-lg"
                        key={displaySrc}  
                        priority  
                        />
                </div>

                {error && (
                    <div className="bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-lg text-center mb-4 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label htmlFor="fileInput" className="block mb-2 text-sm font-medium text-gray-300">Change Profile Picture</label>
                        <input
                            type="file"
                            id="fileInput"
                            accept="image/png, image/jpeg, image/jpg"
                            onChange={handleFileChange}
                            className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer border border-gray-600 rounded-lg cursor-pointer bg-gray-700 focus:outline-none"
                        />
                         <p className="mt-1 text-xs text-gray-500">PNG, JPG or JPEG (MAX. 5MB).</p>
                    </div>
                    <button 
                        type="submit" 
                        className="w-full py-3 font-semibold tracking-wide bg-green-600 hover:bg-green-700 rounded-lg transition-all duration-300 transform hover:-translate-y-0.5 shadow-lg hover:shadow-green-500/50 disabled:opacity-50 disabled:transform-none disabled:shadow-none disabled:cursor-not-allowed"
                        disabled={isUploading || !file}
                    >
                        {isUploading ? 'Uploading...' : 'Save Picture'}
                    </button>
                </form>
            </div>
            
            {/* --- Sticky Footer --- */}
            <footer className="fixed bottom-0 left-0 w-full bg-gray-800/80 backdrop-blur-md border-t border-gray-700/50 py-3 shadow-sm">
                <div className="flex flex-col items-center justify-center gap-1 text-center">
                    <p className="text-gray-400 font-semibold text-sm">
                        Created by <span className="text-blue-400 font-bold">Ashank Gupta</span>
                    </p>
                    <div className="flex justify-center gap-4">
                        <a
                            href="https://www.linkedin.com/in/ashank-gupta-tech"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-400 hover:scale-110 transition-transform"
                        >
                            <FaLinkedin size={20} />
                        </a>
                        <a
                            href="https://github.com/ashank007"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-gray-200 hover:scale-110 transition-transform"
                        >
                            <FaGithub size={20} />
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}