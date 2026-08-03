import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Chat.css';
import { Search, Phone, Smile, Code, Image as ImageIcon } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

import homeIcon from '../assets/Home Outline.png';
import searchIcon from '../assets/Search.png';
import mailIcon from '../assets/Mail Open Fill.png';
import plusIcon from '../assets/Square Rounded Plus.png';
import profileIcon from '../assets/Profile Circle.png';
import settingsIcon from '../assets/Settings.png';

interface User {
  id: number;
  email: string;
  username?: string;
  profile_pic_url?: string;
  last_seen?: string;
  unread_count?: number;
}

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  text: string;
  created_at: string;
}

const Chat = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [chatHistoryUsers, setChatHistoryUsers] = useState<User[]>([]);
  const [activeChatUser, setActiveChatUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  
  // For searching new users to chat with
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<number[]>([]);
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/login');
      return;
    }
    const user = JSON.parse(storedUser);
    setCurrentUser(user);

    // Initialize Socket
    socketRef.current = io('http://localhost:5000');
    socketRef.current.emit('user_connected', { id: user.id, email: user.email });

    // Listen for new messages
    socketRef.current.on('receive_message', (msg: Message) => {
      // If the message is part of the active chat, append it
      setActiveChatUser((prevActive) => {
        if (
          prevActive && 
          ((msg.sender_id === user.id && msg.receiver_id === prevActive.id) || 
           (msg.sender_id === prevActive.id && msg.receiver_id === user.id))
        ) {
          setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Mark as read immediately if chat is open
          if (msg.receiver_id === user.id) {
            socketRef.current?.emit('mark_read', { senderId: msg.sender_id, receiverId: user.id });
          }
        }
        return prevActive;
      });

      // Refresh chat history to include new sender if not there and get latest unread_count
      fetchChatHistory(user.id);
    });

    // Listen for users list (for searching and updated last_seen)
    socketRef.current.on('users_list', (users: User[]) => {
      setAllUsers(users.filter(u => u.id !== user.id));
      // Optionally re-fetch chat history to get updated last_seen for sidebar
      fetchChatHistory(user.id);
    });

    socketRef.current.on('online_users', (userIds: number[]) => {
      setOnlineUserIds(userIds);
    });

    fetchChatHistory(user.id);

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchChatHistory = async (userId: number) => {
    try {
      const res = await fetch(`http://localhost:5000/api/chat-history/${userId}`);
      const data = await res.json();
      setChatHistoryUsers(data);
    } catch (err) {
      console.error('Failed to fetch chat history', err);
    }
  };

  const loadMessages = async (partnerId: number) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`http://localhost:5000/api/messages/${currentUser.id}/${partnerId}`);
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  };

  const handleSelectUser = (user: User) => {
    setActiveChatUser(user);
    loadMessages(user.id);
    setSearchQuery(''); // clear search when user selected
    
    // Optimistically clear unread count locally
    setChatHistoryUsers(prev => 
      prev.map(u => u.id === user.id ? { ...u, unread_count: 0 } : u)
    );
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !activeChatUser || !currentUser || !socketRef.current) return;

    socketRef.current.emit('send_message', {
      senderId: currentUser.id,
      receiverId: activeChatUser.id,
      text: inputValue
    });
    setInputValue('');
  };

  const formatLastSeen = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    if (isNaN(diffMs) || diffMs < 0) return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return `a few seconds ago`;
    if (diffMins === 1) return `a minute ago`;
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours === 1) return `an hour ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return `yesterday`;
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  };

  // Determine what users to show in the left panel
  const displayedUsers = searchQuery.trim() 
    ? allUsers.filter(u => (u.username || u.email).toLowerCase().includes(searchQuery.toLowerCase()))
    : chatHistoryUsers;

  return (
    <div className="chat-container">
      <div className="chat-topbar">CHAT</div>
      
      <div className="chat-body">
        {/* Sidebar */}
        <div className="chat-sidebar">
          <Link to="/chat"><img src={homeIcon} alt="Home" className="chat-sidebar-icon" /></Link>
          <img src={searchIcon} alt="Search" className="chat-sidebar-icon" />
          <Link to="/chat"><img src={mailIcon} alt="Messages" className="chat-sidebar-icon" style={{ opacity: 1 }} /></Link>
          <img src={plusIcon} alt="Add" className="chat-sidebar-icon" />
          <Link to="/settings"><img src={profileIcon} alt="Profile" className="chat-sidebar-icon" /></Link>
          <Link to="/settings"><img src={settingsIcon} alt="Settings" className="chat-sidebar-icon" /></Link>
        </div>

        {/* Messages List Panel */}
        <div className="chat-messages-panel">
          <div className="chat-messages-header">MESSAGES</div>
          <div className="chat-search-container">
            <div className="chat-search-input-wrapper">
              <Search className="chat-search-icon" />
              <input 
                type="text" 
                className="chat-search-input" 
                placeholder="Search users to chat..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="chat-list">
            {displayedUsers.length > 0 ? (
              displayedUsers.map(u => (
                <div 
                  key={u.id} 
                  className={`chat-list-item ${activeChatUser?.id === u.id ? 'active' : ''}`}
                  onClick={() => handleSelectUser(u)}
                >
                  <div style={{ position: 'relative' }}>
                    {u.profile_pic_url ? (
                      <img src={u.profile_pic_url} alt="Avatar" className="chat-avatar" />
                    ) : (
                      <div className="chat-avatar"></div>
                    )}
                    {(Number(u.unread_count) > 0) && (
                      <div className="chat-unread-badge">{u.unread_count}</div>
                    )}
                  </div>
                  <div className="chat-list-name">@{u.username || u.email.split('@')[0]}</div>
                </div>
              ))
            ) : (
              <div style={{ padding: '0 20px', color: '#64748b', fontSize: '13px' }}>
                {searchQuery ? 'No users found.' : 'No chat history. Search above to find users.'}
              </div>
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="chat-main-area">
          {activeChatUser ? (
            <>
              <div className="chat-main-header">
                <div className="chat-header-user">
                  {activeChatUser.profile_pic_url ? (
                    <img src={activeChatUser.profile_pic_url} alt="Avatar" className="chat-avatar" style={{ width: '32px', height: '32px', marginRight: '15px' }} />
                  ) : (
                    <div className="chat-avatar" style={{ width: '32px', height: '32px', marginRight: '15px' }}></div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="chat-header-name" style={{ lineHeight: '1.2' }}>@{activeChatUser.username || activeChatUser.email.split('@')[0]}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      {onlineUserIds.includes(activeChatUser.id) 
                        ? <span style={{color: '#22c55e'}}>Online</span> 
                        : (activeChatUser.last_seen || allUsers.find(u => u.id === activeChatUser.id)?.last_seen)
                          ? `Last seen at ${formatLastSeen(activeChatUser.last_seen || allUsers.find(u => u.id === activeChatUser.id)?.last_seen)}` 
                          : 'Offline'
                      }
                    </div>
                  </div>
                </div>
                <Phone className="chat-header-actions" size={20} />
              </div>

              <div className="chat-history">
                {messages.map((msg) => {
                  const isMe = msg.sender_id === currentUser?.id;
                  return (
                    <div key={msg.id} className={`chat-bubble-container ${isMe ? 'me' : ''}`}>
                      {!isMe && (
                        activeChatUser.profile_pic_url ? (
                          <img src={activeChatUser.profile_pic_url} alt="Avatar" className="chat-bubble-avatar" />
                        ) : (
                          <div className="chat-bubble-avatar"></div>
                        )
                      )}
                      <div className={`chat-bubble ${isMe ? 'me' : ''}`}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-area">
                <form onSubmit={handleSendMessage} className="chat-input-wrapper">
                  <Smile className="chat-input-icon" size={20} />
                  <input 
                    type="text" 
                    className="chat-input" 
                    placeholder="Messages.." 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                  />
                  <Code className="chat-input-icon" size={20} />
                  <ImageIcon className="chat-input-icon" size={20} />
                </form>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              Select a user to start chatting
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
