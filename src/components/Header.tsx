import React, { useState } from 'react';
import { modules } from '../modules';
import {
  PlusCircle,
  LayoutDashboard,
  Languages,
  Layers,
  Cloud,
  CloudOff,
  LogOut,
  LogIn,
  User as UserIcon,
  ChevronDown,
} from 'lucide-react';
import { RIProfile, ModuleType } from '../types';
import { useAuth } from '../lib/AuthContext';

interface HeaderProps {
  currentView: 'dashboard' | 'workflow' | 'report';
  activeModule: ModuleType;
  onSelectModule: (module: ModuleType) => void;
  activeCaseId?: string;
  language: 'en' | 'or';
  riProfile: RIProfile;
  onToggleLanguage: () => void;
  onNewCase: () => void;
  onGoToDashboard: () => void;
  onOpenAILog?: () => void;
  onOpenRIProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  activeModule,
  onSelectModule,
  activeCaseId,
  language,
  riProfile,
  onToggleLanguage,
  onNewCase,
  onGoToDashboard,
  onOpenAILog,
  onOpenRIProfile,
}) => {
  const { user, login, logout, isCloudSynced } = useAuth();
  const [showModuleMenu, setShowModuleMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const homeLabel = language === 'or' ? 'ମୁଖ୍ୟ ପୃଷ୍ଠା' : 'Home';
  const currentModule = modules.find(module => module.id === activeModule);
  const goHome = () => {
    setShowModuleMenu(false);
    setShowUserMenu(false);
    onGoToDashboard();
  };

  return (
    <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between gap-2 bg-[#142843] px-2 py-2 text-white shadow-md sm:px-6 print:hidden">
      <nav aria-label="Main navigation" className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button type="button" onClick={goHome} aria-label="RI Field Report home"
          className="flex shrink-0 items-center gap-2 rounded-md p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <img src={import.meta.env.BASE_URL + 'ri-field-report.png'} alt="" width={36} height={36} className="rounded-lg" />
          <span className="hidden whitespace-nowrap text-sm font-bold md:inline">RI Field Report</span>
        </button>
        <button type="button" onClick={goHome} aria-current={activeModule === 'HOME' ? 'page' : undefined}
          className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <LayoutDashboard aria-hidden="true" className="h-4 w-4" />
          {homeLabel}
        </button>
        <div className="relative min-w-0">
          <button type="button" onClick={() => setShowModuleMenu(!showModuleMenu)}
            aria-label={currentModule ? 'Switch workspace: ' + currentModule.title : 'Choose workspace'}
            aria-expanded={showModuleMenu}
            aria-controls="workspace-menu"
            className="flex min-h-9 max-w-full items-center gap-1 rounded-lg border border-white/25 px-2 text-sm font-medium hover:bg-white/15"
          >
            <Layers aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="hidden truncate lg:inline">{currentModule ? (language === 'or' ? currentModule.odia : currentModule.title) : 'Workspaces'}</span>
            <ChevronDown aria-hidden="true" className="h-3 w-3 shrink-0" />
          </button>
          {showModuleMenu && (
            <div id="workspace-menu" className="fixed inset-x-2 top-14 mt-2 rounded-xl border border-slate-200 bg-white p-1 text-sm text-slate-800 shadow-xl sm:absolute sm:left-0 sm:right-auto sm:top-full sm:w-60">
              {modules.map(module => (
                <button type="button" key={module.id} aria-current={activeModule === module.id ? 'page' : undefined}
                  onClick={() => { setShowModuleMenu(false); onSelectModule(module.id); }}
                  className={`block w-full rounded-lg px-3 py-2 text-left hover:bg-blue-50 ${activeModule === module.id ? 'bg-blue-50 font-semibold text-blue-900' : ''}`}>
                  {language === 'or' ? module.odia : module.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Right Controls & Auth Profile */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        {/* Cloud Sync Status Indicator */}
        <div className="hidden lg:flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-white/10 text-[11px] font-medium">
          {isCloudSynced ? (
            <>
              <Cloud className="w-3.5 h-3.5 text-emerald-300" />
              <span className="text-emerald-200">Cloud Synced</span>
            </>
          ) : (
            <>
              <CloudOff className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-amber-200">Local Only</span>
            </>
          )}
        </div>

        {/* Language Toggle */}
        <button
          onClick={onToggleLanguage}
          className="flex items-center space-x-1 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-medium border border-white/20 transition"
          title="Toggle Language"
        >
          <Languages className="w-3.5 h-3.5 text-amber-300" />
          <span className="hidden min-[380px]:inline">{language === 'en' ? 'ଓଡ଼ିଆ' : 'Eng'}</span>
        </button>

        {/* New Case Button */}
        {activeModule === 'KHANA_2' && currentView === 'dashboard' && (
          <button
            onClick={onNewCase}
            className="flex items-center space-x-1.5 px-3 py-1 rounded bg-amber-400 hover:bg-amber-300 text-blue-950 text-xs font-bold shadow transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">New Case</span>
          </button>
        )}

        {/* Firebase Authentication & User Profile */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 pl-2 border-l border-white/20 hover:opacity-90 transition"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-7 h-7 rounded-full border border-white/40"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-amber-400 text-blue-950 flex items-center justify-center font-bold text-xs">
                  {(user.displayName || 'RI')[0].toUpperCase()}
                </div>
              )}
              <div className="hidden sm:block text-left text-[11px] leading-tight">
                <p className="font-semibold text-white truncate max-w-[120px]">
                  {user.displayName || 'Officer'}
                </p>
                <p className="text-[9px] text-blue-200">Logged in</p>
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 text-slate-800 text-xs z-50">
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <p className="font-bold text-slate-900 truncate">{user.displayName}</p>
                  <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => {
                    onOpenRIProfile();
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center space-x-2 font-medium"
                >
                  <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                  <span>Officer Profile & Circle</span>
                </button>
                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-600 flex items-center space-x-2 font-semibold border-t border-slate-100"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => login()}
            className="flex items-center space-x-1.5 px-3 py-1 rounded bg-white text-blue-900 hover:bg-blue-50 text-xs font-bold shadow transition"
          >
            <LogIn className="w-3.5 h-3.5 text-blue-600" />
            <span>Login</span>
          </button>
        )}
      </div>
    </header>
  );
};
