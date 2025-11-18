'use client';

import { useEffect, useState, FormEvent, useRef, ChangeEvent } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { FaceSmileIcon, ExclamationTriangleIcon, UserMinusIcon } from '@heroicons/react/24/outline';
import { XMarkIcon,ArrowLeftIcon } from '@heroicons/react/24/solid'; // Correct imports
import { v4 as uuidv4 } from 'uuid';
import Lobby from '@/components/Lobby';

// Interfaces
interface ReplyContext {
    id: string;
    sender: string;
    text: string;
}

interface Message {
    id: string; // Unique ID for each message
    text: string;
    sender: 'me' | 'peer';
    replyTo?: ReplyContext | null; // Optional reply data
}

interface PartnerInfo {
    fullName: string;
    profilePicture: string;
}

export default function ChatPage() {
    // --- States ---
    const [socket, setSocket] = useState<Socket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [roomId, setRoomId] = useState<string | null>(null);
    const [status, setStatus] = useState('Connecting...');
    const [isPartnerTyping, setIsPartnerTyping] = useState(false);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [onlineCount, setOnlineCount] = useState(0);

    // Auth
    const { user, loading, isAuthenticated, logout } = useAuth();
    const router = useRouter();

    // Lobby
    const [isInLobby, setIsInLobby] = useState(true);
    const [yearPref, setYearPref] = useState('Random');
    const [genderPref, setGenderPref] = useState('Any');
    const [isWaiting, setIsWaiting] = useState(false);

    // Reveal
    const [isRevealed, setIsRevealed] = useState(false);
    const [partnerInfo, setPartnerInfo] = useState<PartnerInfo | null>(null);
    const [revealRequested, setRevealRequested] = useState(false);

    // Reply
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);

    // Refs
    const messageEndRef = useRef<HTMLDivElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // --- Effects ---

    // Auth Check: Redirect if not logged in
    useEffect(() => {
        if (!loading && !isAuthenticated) {
            router.replace('/login');
        }
    }, [user, loading, isAuthenticated, router]);

    // Scroll to new message
    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Click outside handler for emoji picker
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const emojiButton = document.getElementById('emoji-button');
            if (emojiButton && emojiButton.contains(event.target as Node)) return;
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [emojiPickerRef]);

    // Socket Connection Management
    useEffect(() => {
        if (!isAuthenticated || !user) {
           if (socket) {
              console.log("Disconnecting socket due to auth change or missing user.");
              socket.disconnect();
              setSocket(null);
              setIsInLobby(true); setRoomId(null); setMessages([]); setIsRevealed(false); setPartnerInfo(null);
           }
           return;
        };

        if (!socket || !socket.connected) {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "https://guftagu-deployed.onrender.com";
            console.log("Attempting socket connection to:", backendUrl);
            const newSocket = io(backendUrl, { withCredentials: true, reconnectionAttempts: 5, timeout: 10000 });
            setSocket(newSocket); 

            // --- Define Socket Event Listeners ---
            newSocket.on('connect', () => {
                console.log("Socket connected:", newSocket.id);
                setStatus('Connected. Set preferences to start.');
                setIsInLobby(true);
                setRoomId(null);
            });
            
            newSocket.on('disconnect', (reason) => {
                console.log("Socket disconnected:", reason);
                setStatus('Disconnected. Trying to reconnect...');
                toast.error('Disconnected from chat server.');
                setSocket(null); 
                setIsInLobby(true); 
                setRoomId(null);
                setMessages([]);
                setIsRevealed(false);
                setPartnerInfo(null);
            });
            
            newSocket.on('connect_error', (err) => {
                console.error('Socket connection error:', err);
                setStatus(`Connection Failed: ${err.message}. Retrying...`);
            });
            
            newSocket.on('waiting-for-peer', () => {
                 setStatus('Waiting for a peer to connect...');
                 setIsWaiting(true);
            });
            
            newSocket.on('chat-started', ({ roomId: newRoomId }) => {
                console.log("Chat started in room:", newRoomId);
                setRoomId(newRoomId);
                setStatus('Connected! Say hi.');
                setIsInLobby(false);
                setIsWaiting(false);
                setMessages([]); 
                setIsRevealed(false); 
                setPartnerInfo(null);
                setRevealRequested(false);
                setReplyingTo(null);
                toast.success('Partner found!');
            });
            
            newSocket.on('stopped-waiting', () => {
                setStatus('Matching stopped. Set preferences to start.');
                setIsWaiting(false);
            });
            
            // --- UPDATED new-message LISTENER ---
            newSocket.on('new-message', (data: { message: Message }) => {
                const incomingMessage: Message = {
                    ...data.message,
                    sender: 'peer' // Set sender as 'peer'
                };
                
                // Flip the sender name in the reply context
                if (incomingMessage.replyTo) {
                    incomingMessage.replyTo.sender = incomingMessage.replyTo.sender === "You" ? "Partner" : "You";
                }

                setMessages((prev) => [...prev, incomingMessage]);
                setIsPartnerTyping(false);
            });
            
            newSocket.on('typing-status', ({ isTyping: partnerIsTyping }) => {
                setIsPartnerTyping(partnerIsTyping);
            });
            
            newSocket.on('reveal-requested', () => {
                setStatus('Partner wants to reveal identity. Click reveal to accept.');
                setRevealRequested(true);
                toast('Partner wants to reveal identities!', { icon: '🤝' });
            });
            
            newSocket.on('identity-revealed', (data) => {
                const partnerKey = Object.keys(data).find(key => key !== newSocket.id);
                if (partnerKey) setPartnerInfo(data[partnerKey]);
                setIsRevealed(true);
                setRevealRequested(false);
                setStatus('Identities revealed!');
                toast.success('Identities Revealed!');
            });
            
            newSocket.on('chat-ended', (data?: { reason?: string }) => {
                console.log("Chat ended event received, reason:", data?.reason);
                const reason = data?.reason || 'Chat ended. Find new chat.';
                setIsInLobby(true);
                setRoomId(null);
                setMessages([]);
                setIsRevealed(false);
                setPartnerInfo(null);
                setRevealRequested(false);
                setIsWaiting(false);
                setReplyingTo(null);
                setStatus(reason);
                toast(reason.includes('disconnected') || reason.includes('ended by') ? 'Partner disconnected.' : 'Chat Ended.', { icon: '👋' });
            });
            
            newSocket.on('update-online-count', (count: number) => setOnlineCount(count));
            
            newSocket.on('action-success', (data: { message: string }) => toast.success(data.message));
            newSocket.on('action-failed', (data: { message: string }) => toast.error(data.message));
            newSocket.on('action-info', (data: { message: string }) => toast(data.message, { icon: 'ℹ️' }));
            
            newSocket.on('account-suspended', (data: { reason: string }) => {
                toast.error(`ACCOUNT SUSPENDED: ${data.reason}`, { duration: 10000, icon: '🚫' });
                setIsInLobby(true);
                setRoomId(null);
                if (newSocket) newSocket.disconnect();
                 logout(); 
                 router.replace('/login');
            });
            
            newSocket.on('match-failed', (data: { message: string }) => {
                 setStatus(data.message);
                 setIsWaiting(false);
                 toast.error(data.message);
            });
            
             newSocket.on('find-new-chat', () => {
                 console.log("Received find-new-chat, returning to lobby.");
                 setIsInLobby(true);
                 setRoomId(null);
                 setMessages([]);
                 setIsRevealed(false);
                 setPartnerInfo(null);
                 setRevealRequested(false);
                 setIsWaiting(false);
                 setReplyingTo(null);
                 setStatus('Ready to find a new chat.');
             });
        } 

        return () => {
            if (socket) {
                console.log("Disconnecting socket on cleanup.");
                socket.off(); 
                socket.disconnect();
                setSocket(null); // <-- This was causing the loop
            }
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        };
    // --- THIS IS THE CORRECTED DEPENDENCY ARRAY ---
    }, [user, isAuthenticated, logout, router]);


    // --- Handlers ---
    const startChat = () => {
        if (socket && socket.connected) {
            setStatus('Looking for a partner...');
            setIsWaiting(true);
            socket.emit('start-guftagu', { year: yearPref, gender: genderPref });
        } else {
             toast.error("Not connected. Trying to reconnect...");
        }
    };

    const stopChat = () => {
      if (socket && socket.connected) {
              setStatus('Stopping match search...');
              setIsWaiting(false);
              socket.emit('stop-matching');
            }
        };

    // --- UPDATED handleSendMessage ---
    const handleSendMessage = (e: FormEvent) => {
        e.preventDefault();
        const messageToSend = newMessage.trim();
        if (messageToSend && roomId && socket && socket.connected) {
            
            // 1. Create the reply context as *I* see it
            const myReplyContext: ReplyContext | null = replyingTo ? {
                id: replyingTo.id,
                sender: replyingTo.sender === 'me' ? "You" : "Partner", // How it looks *to me*
                text: replyingTo.text
            } : null;

            // 2. Create the message object for *my* UI
            const myNewMessage: Message = {
                id: uuidv4(),
                text: messageToSend,
                sender: 'me',
                replyTo: myReplyContext
            };

            // 3. Create the message object to *send* to the partner
            //    (The partner's UI will flip the sender names)
            const messageForPartner: Message = {
                id: myNewMessage.id, // Use same ID
                text: messageToSend,
                sender: 'me', // Partner will flip this to 'peer'
                replyTo: myReplyContext // Send *my* perspective, partner's UI will flip "You" to "Partner"
            };

            // Add my version to my UI
            setMessages((prev) => [...prev, myNewMessage]); 
            // Send the partner's version to the server
            socket.emit('send-message', { roomId, message: messageForPartner }); 

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            socket.emit('typing', { roomId, isTyping: false });

            setNewMessage(''); 
            setReplyingTo(null); // Reset reply state
        }
    };

    const onEmojiClick = (emojiData: EmojiClickData) => {
        setNewMessage((prev) => prev + emojiData.emoji);
        setShowEmojiPicker(false);
        document.getElementById('message-input')?.focus(); 
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const currentMessage = e.target.value;
        setNewMessage(currentMessage);
        if (!socket || !roomId || !socket.connected) return;
        socket.emit('typing', { roomId, isTyping: true });
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
             if (socket && socket.connected) {
                socket.emit('typing', { roomId, isTyping: false });
             }
        }, 1500);
    };

    const handleNextChat = () => {
        if (socket && socket.connected && roomId) {
            toast('Finding next chat...');
            socket.emit('next-chat', { roomId });
        }
         setIsInLobby(true); setRoomId(null); setMessages([]); setIsRevealed(false);
         setPartnerInfo(null); setRevealRequested(false); setIsWaiting(false);
         setReplyingTo(null);
         setStatus('Finding next chat...');
    };

    const handleReveal = () => {
        if (socket && socket.connected && roomId) {
            socket.emit('request-reveal', { roomId });
            toast('Reveal request sent!', { icon: '✉️' });
            setStatus(revealRequested ? 'You accepted the reveal request.' : 'Reveal request sent. Waiting for partner.');
        }
    };

    const handleReport = () => {
        if (socket && socket.connected && roomId) {
            toast(
                (t) => (
                    <div className="flex flex-col items-center gap-3 p-2 bg-gray-700 rounded shadow-lg">
                        <span className="text-center font-semibold text-white">Report user for inappropriate behavior?</span>
                        <div className="flex gap-4 mt-2">
                            <button
                                onClick={() => {
                                    if (socket && socket.connected) socket.emit('report-user', { roomId });
                                    toast.dismiss(t.id);
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded text-sm transition-colors"
                            > Yes, Report </button>
                            <button
                                onClick={() => toast.dismiss(t.id)}
                                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-1.5 px-3 rounded text-sm transition-colors"
                            > Cancel </button>
                        </div>
                    </div>
                ), { duration: 10000, position: 'top-center' }
            );
        } else {
             toast.error("Cannot report: Not connected or not in a chat.");
        }
    };

    const handleBlock = () => {
        if (socket && socket.connected && roomId) {
             toast(
                (t) => (
                    <div className="flex flex-col items-center gap-3 p-2 bg-gray-700 rounded shadow-lg">
                        <span className="text-center font-semibold text-white">Block user & end chat?<br/><small>(You won't be matched again)</small></span>
                         <div className="flex gap-4 mt-2">
                             <button
                                onClick={() => {
                                    if (socket && socket.connected) socket.emit('block-user', { roomId });
                                    toast.dismiss(t.id);
                                }}
                                className="bg-red-700 hover:bg-red-800 text-white font-bold py-1.5 px-3 rounded text-sm transition-colors"
                            > Yes, Block </button>
                            <button
                                onClick={() => toast.dismiss(t.id)}
                                className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-1.5 px-3 rounded text-sm transition-colors"
                            > Cancel </button>
                        </div>
                    </div>
                ), { duration: 10000, position: 'top-center' }
            );
        } else {
             toast.error("Cannot block: Not connected or not in a chat.");
        }
    };


    // --- Renders ---
    if (loading || (!isAuthenticated && !loading)) {
        return <div className="flex h-screen items-center justify-center bg-gray-900 text-white">Loading...</div>;
    }

    if (isInLobby || !socket?.connected) {
        return (
            <Lobby
                user={user}
                yearPref={yearPref} setYearPref={setYearPref}
                genderPref={genderPref} setGenderPref={setGenderPref}
                isWaiting={isWaiting}
                startChat={startChat} stopChat={stopChat}
                onlineCount={onlineCount} status={status}
                logout={logout}
            />
        );
    }

    // Chat Room UI
    return (
        <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">

            {/* Header */}
            <header className="sticky top-0 z-10 p-3 md:p-4 bg-gray-800 shadow-md flex justify-between items-center flex-shrink-0 border-b border-gray-700">
                {/* Partner Info */}
                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 mr-2">
                     {isRevealed && partnerInfo && (
                        <Image
                            src={ partnerInfo.profilePicture && partnerInfo.profilePicture !== 'default_avatar_url' && partnerInfo.profilePicture !== '' ? partnerInfo.profilePicture : '/default-avatar.png' }
                            alt={partnerInfo.fullName || 'Partner'} width={32} height={32}
                            className="rounded-full object-cover flex-shrink-0 md:w-10 md:h-10"
                            key={partnerInfo.profilePicture || 'default'}
                         />
                     )}
                     <h1 className="text-lg md:text-xl font-semibold truncate">
                         {isRevealed && partnerInfo ? partnerInfo.fullName : 'Guftagu'}
                     </h1>
                 </div>
                {/* Action Buttons */}
                <div className="flex items-center gap-1 sm:gap-1.5 md:gap-2 flex-shrink-0">
                    <button onClick={handleReport} disabled={!roomId} title="Report User"
                        className="p-1.5 md:p-2 text-yellow-400 hover:text-yellow-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors rounded-full hover:bg-gray-700">
                        <ExclamationTriangleIcon className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                     <button onClick={handleBlock} disabled={!roomId} title="Block User"
                        className="p-1.5 md:p-2 text-red-500 hover:text-red-400 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors rounded-full hover:bg-gray-700">
                        <UserMinusIcon className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                     <div className="h-5 md:h-6 w-px bg-gray-600 mx-1 md:mx-2"></div>
                    <button onClick={handleReveal} disabled={isRevealed || !roomId}
                        className="px-2.5 py-1 md:px-3 md:py-1.5 text-xs md:text-sm bg-green-600 rounded hover:bg-green-700 transition-colors disabled:opacity-50 whitespace-nowrap">
                        {isRevealed ? 'Revealed' : (revealRequested ? 'Accept' : 'Reveal')}
                    </button>
                    <button onClick={handleNextChat}
                        className="px-2.5 py-1 md:px-3 md:py-1.5 text-xs md:text-sm bg-red-600 rounded hover:bg-red-700 transition-colors whitespace-nowrap">
                        Next Chat
                    </button>
                </div>
            </header>

            {/* Chat Messages Area */}
            <div className="flex-1 p-3 md:p-4 overflow-y-auto space-y-1 md:space-y-2" id="chat-area">
                 <div className="text-center text-gray-500 mb-2 md:mb-4 text-xs md:text-sm">{status}</div>
                 
                 {messages.map((msg) => {
                                     const isReplyingToThis = replyingTo?.id === msg.id;
                                     return (
                                         <div key={msg.id} id={msg.id} className={`flex ${ msg.sender === 'me' ? 'justify-end' : 'justify-start' } my-1`}>
                                             <div className={`relative p-2 md:p-3 rounded-lg max-w-[75%] sm:max-w-[70%] shadow group ${
                                                 msg.sender === 'me' ? 'bg-blue-600 rounded-br-none text-white' : 'bg-gray-700 rounded-bl-none text-gray-100'
                                             } ${
                                                 isReplyingToThis ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''
                                             }`}>
                                                 
                                                 {/* Reply Button */}
                                                 <button 
                                                     onClick={() => setReplyingTo(msg)}
                                                     className={`absolute top-0 p-1 bg-gray-900/30 rounded-full opacity-0 transition-all ${
                                                         msg.sender === 'me' ? 'top-1 right-1' : 'top-1 left-1'
                                                     } group-hover:opacity-100 group-hover:scale-110`}
                                                     title="Reply"
                                                 >
                                                     <ArrowLeftIcon className="h-4 w-4 text-white/70" />
                                                 </button>
                                                 
                                                 {/* Render Quoted Message */}
                                                 {msg.replyTo && (
                                                     // --- THIS BLOCK IS CORRECTED ---
                                                     <div className="p-2 mb-2 bg-black/20 rounded-md border-l-4 border-blue-300 cursor-pointer" onClick={() => {
                                                         // Add the check *inside* the onClick handler
                                                         if (msg.replyTo) { 
                                                             const originalMsgEl = document.getElementById(msg.replyTo.id);
                                                             if (originalMsgEl) originalMsgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                         }
                                                     }}>
                                                     {/* --- END CORRECTION --- */}
                                                         <p className="font-bold text-sm text-blue-300">
                                                             {msg.replyTo.sender}
                                                         </p>
                                                         <p className="text-sm opacity-90 truncate">
                                                             {msg.replyTo.text}
                                                         </p>
                                                     </div>
                                                 )}
                                                 
                                                 {/* Main Message Text */}
                                                 <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                                             </div>
                                         </div>
                                     );
                                 })}
                {isPartnerTyping && (
                    <div className="flex justify-start">
                         <div className="p-2 md:p-3 rounded-lg bg-gray-700 rounded-bl-none shadow">
                            <span className="italic text-gray-400 text-sm">Typing...</span>
                         </div>
                    </div>
                )}
                <div ref={messageEndRef} />
            </div>

            {/* Message Input Form */}
            <div className="relative p-2 md:p-4 bg-gray-800 border-t border-gray-700 flex-shrink-0">
                {/* Reply Preview Box */}
                {replyingTo && (
                    <div className="p-2 mb-2 bg-gray-700 rounded-lg border-l-4 border-blue-400 flex justify-between items-center">
                        <div>
                            <p className="font-bold text-sm text-blue-400">
                                Replying to {replyingTo.sender === 'me' ? "Yourself" : "Partner"}
                            </p>
                            <p className="text-sm text-gray-300 truncate max-w-xs sm:max-w-md">
                                {replyingTo.text}
                            </p>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="p-1 rounded-full hover:bg-gray-600 flex-shrink-0">
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>
                )}

                {showEmojiPicker && (
                    <div className="absolute bottom-[60px] md:bottom-[70px] right-2 md:right-4 z-10" ref={emojiPickerRef}>
                        <EmojiPicker
                            onEmojiClick={onEmojiClick}
                            theme={Theme.DARK}
                            lazyLoadEmojis={true}
                            height={320}
                            width={'90vw'}
                            previewConfig={{showPreview: false}}
                            searchDisabled
                            style={{maxWidth: '300px'}}
                        />
                    </div>
                )}
                
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                     <input
                        id="message-input"
                        type="text"
                        value={newMessage}
                        onChange={handleInputChange}
                        placeholder={roomId ? "Type a message..." : "Connecting..."}
                        className="flex-1 px-3 py-2.5 md:px-4 md:py-3 bg-gray-700 rounded-lg border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white text-sm md:text-base"
                        disabled={!roomId}
                        autoComplete="off"
                     />
                     <button
                        id="emoji-button"
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className="p-2.5 md:p-3 text-gray-400 hover:text-gray-200 bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!roomId}
                        title="Emoji"
                     >
                        <FaceSmileIcon className="h-5 w-5 md:h-6 md:w-6" />
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2.5 md:px-6 md:py-3 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-semibold text-sm md:text-base"
                        disabled={!roomId || newMessage.trim() === ''}
                        title="Send Message"
                    >
                        Send
                    </button>
                 </form>
             </div>
        </div>
    );
}