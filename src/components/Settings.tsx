import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import './Settings.css';

import homeIcon from '../assets/Home Outline.png';
import searchIcon from '../assets/Search.png';
import mailIcon from '../assets/Mail Open Fill.png';
import plusIcon from '../assets/Square Rounded Plus.png';
import profileIcon from '../assets/Profile Circle.png';
import settingsIcon from '../assets/Settings.png';

interface UserProfile {
  id: number;
  email: string;
  username: string;
  bio: string;
  banner_url: string;
  profile_pic_url: string;
  skills: string[];
}

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [skillInput, setSkillInput] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      navigate('/login');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    
    fetch(`http://localhost:5000/api/user/${parsedUser.id}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          data.skills = typeof data.skills === 'string' ? JSON.parse(data.skills) : (data.skills || []);
          setUser({
            ...data,
            username: data.username || data.email?.split('@')[0] || 'user'
          });
        } else {
          console.error(data.error);
          alert(`Server error: ${data.error}. Please make sure the backend is running properly.`);
        }
      })
      .catch(err => {
        console.error('Failed to load profile', err);
        alert('Failed to connect to the backend server. Please ensure the server is running on port 5000.');
      });
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const res = await fetch(`http://localhost:5000/api/user/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (!data.error) {
        setSaveStatus('Saved!');
        setTimeout(() => setSaveStatus(''), 2000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'profile_pic_url' | 'banner_url') => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:5000/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        const fullUrl = `http://localhost:5000${data.url}`;
        setUser(prev => prev ? { ...prev, [field]: fullUrl } : null);
        handleUpdateProfile({ [field]: fullUrl });
      }
    } catch (err) {
      console.error('File upload failed', err);
    }
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      const newSkills = [...(user?.skills || []), skillInput.trim()];
      setUser(prev => prev ? { ...prev, skills: newSkills } : null);
      setSkillInput('');
      handleUpdateProfile({ skills: newSkills });
    }
  };

  const removeSkill = (indexToRemove: number) => {
    if (!user) return;
    const newSkills = user.skills.filter((_, idx) => idx !== indexToRemove);
    setUser({ ...user, skills: newSkills });
    handleUpdateProfile({ skills: newSkills });
  };

  if (!user) return <div style={{color: 'white', padding: '20px'}}>Loading...</div>;

  return (
    <div className="settings-container">
      <div className="settings-topbar">SETTINGS</div>
      
      <div className="settings-body">
        {/* Sidebar */}
        <div className="settings-sidebar">
          <Link to="/chat"><img src={homeIcon} alt="Home" className="settings-sidebar-icon" /></Link>
          <img src={searchIcon} alt="Search" className="settings-sidebar-icon" />
          <Link to="/chat"><img src={mailIcon} alt="Messages" className="settings-sidebar-icon" /></Link>
          <img src={plusIcon} alt="Add" className="settings-sidebar-icon" />
          <img src={profileIcon} alt="Profile" className="settings-sidebar-icon" />
          <img src={settingsIcon} alt="Settings" className="settings-sidebar-icon" style={{ opacity: 1 }} />
        </div>

        {/* Middle Panel */}
        <div className="settings-menu-panel">
          <div className="settings-menu-header">SETTINGS</div>
          <div className="settings-search-container">
            <div className="settings-search-input-wrapper">
              <Search className="settings-search-icon" />
              <input type="text" className="settings-search-input" placeholder="Search" />
            </div>
          </div>
          
          <div className="settings-menu-list">
            <div className="settings-menu-item active">Edit Profile</div>
            <div className="settings-menu-item">Account Details</div>
          </div>

          <button className="settings-logout-btn" onClick={handleLogout}>Logout</button>
        </div>

        {/* Main Area */}
        <div className="settings-main-area">
          <div className="settings-main-header">
            Edit Profile {saveStatus && <span style={{color: '#22c55e', fontSize: '14px', marginLeft: '10px'}}>{saveStatus}</span>}
          </div>

          {/* Profile Pic Card */}
          <div className="settings-card" style={{ marginBottom: '20px' }}>
            <div className="settings-card-left">
              <img src={user.profile_pic_url || 'https://via.placeholder.com/60'} alt="Avatar" className="settings-avatar-large" />
              <input 
                type="text" 
                className="settings-username-input" 
                value={`@${user.username}`} 
                onChange={(e) => {
                  const val = e.target.value.replace('@', '');
                  setUser({...user, username: val});
                }}
                onBlur={() => handleUpdateProfile({ username: user.username })}
              />
            </div>
            <div className="settings-btn" onClick={() => profilePicInputRef.current?.click()}>
              change pic
              <input 
                type="file" 
                ref={profilePicInputRef} 
                className="settings-file-input" 
                accept="image/*" 
                onChange={(e) => handleFileUpload(e, 'profile_pic_url')}
              />
            </div>
          </div>

          {/* Banner Card */}
          <div className="settings-section-title">Banner</div>
          <div className="settings-banner-card">
            {user.banner_url ? (
              <img src={user.banner_url} alt="Banner" className="settings-banner-img" />
            ) : (
              <div style={{ padding: '20px', color: '#64748b' }}>No banner image</div>
            )}
            <div className="settings-banner-btn-wrapper">
              <div className="settings-btn" onClick={() => bannerInputRef.current?.click()}>
                change pic
                <input 
                  type="file" 
                  ref={bannerInputRef} 
                  className="settings-file-input" 
                  accept="image/*" 
                  onChange={(e) => handleFileUpload(e, 'banner_url')}
                />
              </div>
            </div>
          </div>

          {/* Bio Card */}
          <div className="settings-section-title">Bio</div>
          <textarea 
            className="settings-bio-textarea" 
            value={user.bio || ''}
            onChange={(e) => setUser({...user, bio: e.target.value})}
            onBlur={() => handleUpdateProfile({ bio: user.bio })}
            placeholder="Tell us about yourself..."
          />

          {/* Skills Card */}
          <div className="settings-section-title">Skills</div>
          <div className="settings-skills-container">
            {user.skills?.map((skill, index) => (
              <div key={index} className="settings-skill-pill">
                {skill}
                <div className="settings-skill-remove" onClick={() => removeSkill(index)}>x</div>
              </div>
            ))}
            <input 
              type="text" 
              className="settings-skill-input" 
              placeholder={user.skills?.length ? "" : "Type a skill and press Enter..."}
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={handleSkillKeyDown}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
