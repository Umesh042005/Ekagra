import { Home, BarChart2, User, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function BottomNav() {
  const { role } = useAuth();
  const currentRole = role === 'coach' ? 'mentor' : 'student';
  const location = useLocation();
  const navigate = useNavigate();

  const pathname = location.pathname;
  const activeTab = pathname.includes('/sessions')
    ? 'sessions'
    : pathname.includes('/students')
    ? 'students'
    : pathname.includes('/progress')
    ? 'progress'
    : pathname.includes('/profile')
    ? 'profile'
    : 'home';


  const handleNav = (tab) => {
    navigate(`/${currentRole}/${tab}`);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-[#FCFAF7]/95 backdrop-blur-md border-t border-[#EFE4D8] px-4 py-2"
      aria-label="Bottom navigation"
    >
      <div className="max-w-md md:max-w-xl mx-auto flex items-center justify-around">
        {/* Tab 1: Home */}
        <button
          id="nav-home"
          type="button"
          onClick={() => handleNav('home')}
          className="flex flex-col items-center justify-center min-w-[56px] py-1 cursor-pointer transition-colors relative"
          aria-label="Home"
        >
          <Home
            size={22}
            className={activeTab === 'home' ? 'text-[#BA6838]' : 'text-[#8C7A70]'}
            fill={activeTab === 'home' ? '#BA6838' : 'none'}
            strokeWidth={activeTab === 'home' ? 1.5 : 2}
          />
          <span
            className={`text-[11px] mt-0.5 leading-tight ${
              activeTab === 'home' ? 'text-[#BA6838] font-bold' : 'text-[#8C7A70] font-medium'
            }`}
          >
            Home
          </span>
          {activeTab === 'home' && (
            <div className="w-5 h-1 bg-[#BA6838] rounded-full mt-1" />
          )}
        </button>

        {/* Tab 2: Sessions */}
        <button
          id="nav-sessions"
          type="button"
          onClick={() => handleNav('sessions')}
          className="flex flex-col items-center justify-center min-w-[56px] py-1 cursor-pointer transition-colors relative"
          aria-label="Sessions"
        >
          <div className="w-[22px] h-[22px] flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 3C12 3 8.5 8 8.5 13C8.5 16 10 18 12 19C14 18 15.5 16 15.5 13C15.5 8 12 3 12 3Z"
                fill={activeTab === 'sessions' ? '#BA6838' : 'none'}
                stroke={activeTab === 'sessions' ? '#BA6838' : '#8C7A70'}
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M6 10C6 10 5.5 14.5 8.5 17C10 18.5 12 19 12 19C12 19 10.5 16.5 9.5 14C8.5 11.5 6 10 6 10Z"
                fill={activeTab === 'sessions' ? '#BA6838' : 'none'}
                stroke={activeTab === 'sessions' ? '#BA6838' : '#8C7A70'}
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M18 10C18 10 18.5 14.5 15.5 17C14 18.5 12 19 12 19C12 19 13.5 16.5 14.5 14C15.5 11.5 18 10 18 10Z"
                fill={activeTab === 'sessions' ? '#BA6838' : 'none'}
                stroke={activeTab === 'sessions' ? '#BA6838' : '#8C7A70'}
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span
            className={`text-[11px] mt-0.5 leading-tight ${
              activeTab === 'sessions' ? 'text-[#BA6838] font-bold' : 'text-[#8C7A70] font-medium'
            }`}
          >
            Sessions
          </span>
          {activeTab === 'sessions' && (
            <div className="w-5 h-1 bg-[#BA6838] rounded-full mt-1" />
          )}
        </button>

        {/* Tab (Mentor Only): Students Availability */}
        {role === 'coach' && (
          <button
            id="nav-students"
            type="button"
            onClick={() => handleNav('students')}
            className="flex flex-col items-center justify-center min-w-[56px] py-1 cursor-pointer transition-colors relative"
            aria-label="Students"
          >
            <Users
              size={22}
              className={activeTab === 'students' ? 'text-[#BA6838]' : 'text-[#8C7A70]'}
              strokeWidth={activeTab === 'students' ? 2.5 : 2}
            />
            <span
              className={`text-[11px] mt-0.5 leading-tight ${
                activeTab === 'students' ? 'text-[#BA6838] font-bold' : 'text-[#8C7A70] font-medium'
              }`}
            >
              Students
            </span>
            {activeTab === 'students' && (
              <div className="w-5 h-1 bg-[#BA6838] rounded-full mt-1" />
            )}
          </button>
        )}

        {/* Tab 3: Progress */}
        <button
          id="nav-progress"
          type="button"
          onClick={() => handleNav('progress')}
          className="flex flex-col items-center justify-center min-w-[56px] py-1 cursor-pointer transition-colors relative"
          aria-label="Progress"
        >
          <BarChart2
            size={22}
            className={activeTab === 'progress' ? 'text-[#BA6838]' : 'text-[#8C7A70]'}
            strokeWidth={activeTab === 'progress' ? 2.5 : 2}
          />
          <span
            className={`text-[11px] mt-0.5 leading-tight ${
              activeTab === 'progress' ? 'text-[#BA6838] font-bold' : 'text-[#8C7A70] font-medium'
            }`}
          >
            Progress
          </span>
          {activeTab === 'progress' && (
            <div className="w-5 h-1 bg-[#BA6838] rounded-full mt-1" />
          )}
        </button>

        {/* Tab 4: Profile */}
        <button
          id="nav-profile"
          type="button"
          onClick={() => handleNav('profile')}
          className="flex flex-col items-center justify-center min-w-[56px] py-1 cursor-pointer transition-colors relative"
          aria-label="Profile"
        >
          <User
            size={22}
            className={activeTab === 'profile' ? 'text-[#BA6838]' : 'text-[#8C7A70]'}
            strokeWidth={activeTab === 'profile' ? 2.5 : 2}
          />
          <span
            className={`text-[11px] mt-0.5 leading-tight ${
              activeTab === 'profile' ? 'text-[#BA6838] font-bold' : 'text-[#8C7A70] font-medium'
            }`}
          >
            Profile
          </span>
          {activeTab === 'profile' && (
            <div className="w-5 h-1 bg-[#BA6838] rounded-full mt-1" />
          )}
        </button>
      </div>
    </nav>
  );
}
