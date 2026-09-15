import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from './ConfirmModal.jsx';
import { clearToken } from '../utils/auth.js';

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    clearToken();
    window.location.href = '/login';
  };

  return (
    <div className="user-menu" ref={menuRef}>
      <button className="user-menu-trigger" onClick={() => setOpen((o) => !o)} aria-label="Account menu">
        👤
      </button>

      {open && (
        <div className="user-menu-dropdown">
          <button
            className="user-menu-item"
            onClick={() => {
              setOpen(false);
              navigate('/profile');
            }}
          >
            👤 Profile
          </button>
          <button
            className="user-menu-item user-menu-item-danger"
            onClick={() => {
              setOpen(false);
              setShowLogoutConfirm(true);
            }}
          >
            🚪 Logout
          </button>
        </div>
      )}

      {showLogoutConfirm && (
        <ConfirmModal
          icon="🚪"
          title="Log Out?"
          message="You'll need to sign in again to access the admin dashboard. Continue?"
          confirmLabel="Yes, Log Out"
          onCancel={() => setShowLogoutConfirm(false)}
          onConfirm={handleLogout}
        />
      )}
    </div>
  );
}
