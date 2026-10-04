import { Bell, Settings, LogOut, CheckCheck, Sparkles, Clock, AlertCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { formatNotificationTime } from '../utils/dateUtils';

export default function Header() {
  const { logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const dropdownRef = useRef(null);

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get('/notifications');
      const list = res.data?.notifications || [];
      setNotifications(list);
      setUnreadCount(res.data?.unread_count ?? list.filter((n) => !n.is_read).length);
    } catch {
      // Ignore background notification fetch errors
    }
  };

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 25000); // 25s background refresh
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  // Mark single notification read
  const handleMarkRead = async (id, isRead) => {
    if (isRead) return;
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error(err);
    }
  };

  // Mark all read
  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 bg-[#F6ECE2]/90 backdrop-blur-md border-b border-[#EFE4D8]">
      <div className="max-w-md md:max-w-xl mx-auto px-4 py-3 flex items-center justify-between relative">
        {/* Logo and Tagline */}
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity"
        >
          {/* Terracotta Lotus / Leaf icon */}
          <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M16 3C16 3 11.5 9 11.5 15C11.5 18.5 13.5 21 16 22C18.5 21 20.5 18.5 20.5 15C20.5 9 16 3 16 3Z"
                fill="#BA6838"
              />
              <path
                d="M8.5 10.5C8.5 10.5 8 16 11.5 19.5C13.5 21.5 16 22 16 22C16 22 14 18.5 13 15C12 11.5 8.5 10.5 8.5 10.5Z"
                fill="#BA6838"
                fillOpacity="0.88"
              />
              <path
                d="M23.5 10.5C23.5 10.5 24 16 20.5 19.5C18.5 21.5 16 22 16 22C16 22 18 18.5 19 15C20 11.5 23.5 10.5 23.5 10.5Z"
                fill="#BA6838"
                fillOpacity="0.88"
              />
            </svg>
          </div>
          <div>
            <span className="font-bold text-xl tracking-tight block leading-tight" style={{ color: '#BA6838' }}>
              Ekagra
            </span>
            <span className="text-[11px] font-normal block leading-tight mt-0.5" style={{ color: '#857368' }}>
              A Calmer Mind, A Brighter Tomorrow
            </span>
          </div>
        </div>

        {/* Actions: Bell & Settings */}
        <div className="flex items-center gap-2">
          {/* Notification Button */}
          <div className="relative">
            <button
              id="notifications-bell-btn"
              aria-label="Notifications"
              onClick={() => {
                setShowNotifications((v) => !v);
                setShowMenu(false);
              }}
              className="w-10 h-10 flex items-center justify-center rounded-2xl bg-[#EFE3D5] hover:bg-[#E7D9C9] transition-colors relative cursor-pointer"
            >
              <Bell size={18} style={{ color: '#4A3728' }} />

              {/* Unread badge count (only if unread > 0) */}
              {unreadCount > 0 && (
                <span
                  id="notifications-unread-badge"
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#D9532F] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-in zoom-in"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {showNotifications && (
              <div
                ref={dropdownRef}
                className="absolute right-0 top-12 w-80 sm:w-88 bg-white rounded-3xl p-4 shadow-xl border border-[#EFE4D8] z-50 fade-up space-y-3"
              >
                {/* Panel Header */}
                <div className="flex items-center justify-between pb-2 border-b border-[#F4E9DF]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-[#261B14]">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold text-[#BA6838] bg-[#FDF0E6] px-2 py-0.5 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[11px] font-semibold text-[#BA6838] hover:underline flex items-center gap-1"
                    >
                      <CheckCheck size={13} />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>

                {/* Notifications List */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {notifications.length > 0 ? (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleMarkRead(n.id, n.is_read)}
                        className={`p-3 rounded-2xl cursor-pointer transition-all border text-xs space-y-1 ${
                          !n.is_read
                            ? 'bg-[#FAF2EB] border-[#F2DECE] text-[#261B14] hover:bg-[#F6E8DC]'
                            : 'bg-[#FCFAF8] border-[#F3ECE4] text-[#7A6960] hover:bg-[#F9F5F1]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium leading-snug flex-1">
                            {n.message}
                          </p>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-[#BA6838] flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[#9A897F]">
                          <Clock size={11} />
                          <span>{formatNotificationTime(n.created_at)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center space-y-1.5">
                      <p className="text-2xl">🌿</p>
                      <p className="text-xs font-semibold text-[#261B14]">All caught up!</p>
                      <p className="text-[11px] text-[#857368]">
                        You have no new notifications right now.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Settings button with dropdown */}
          <div className="relative">
            <button
              id="settings-btn"
              aria-label="Settings"
              onClick={() => {
                setShowMenu((v) => !v);
                setShowNotifications(false);
              }}
              className="w-10 h-10 flex items-center justify-center rounded-2xl bg-[#EFE3D5] hover:bg-[#E7D9C9] transition-colors cursor-pointer"
            >
              <Settings size={18} style={{ color: '#4A3728' }} />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-12 w-48 card py-2 fade-up shadow-xl z-50 bg-[#FDFBF8] border border-[#EFE4D8] rounded-2xl">
                <button
                  id="logout-btn"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold
                             text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={15} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
