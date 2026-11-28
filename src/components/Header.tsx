import React, { useState } from 'react';
import {
  FileText,
  PlusCircle,
  LayoutDashboard,
  Languages,
  FileCode,
  Shield,
  Layers,
  Sparkles,
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

  const getModuleLabel = (mod: ModuleType) => {
    switch (mod) {
      case 'HOME':
        return language === 'or' ? 'ମୁଖ୍ୟ ପୃଷ୍ଠା (Dashboard)' : 'Home Portal';
      case 'KHANA_2':
        return language === 'or' ? 'ଖାନା-୨ ସଂଶୋଧନ' : 'Khana-2 Correction';
      case 'ENCROACHMENT':
        return 'G Form & Register IV';
      case 'DISPATCH':
        return 'Dispatch & Letters';
      case 'COLUMN_2_CAMP':
        return language === 'or' ? 'ଖାନା-୨ କ୍ୟାମ୍ପ (Annexure-II)' : 'Column 2 Camp (Annexure-II)';
      case 'FARMER_VERIFICATION':
        return language === 'or' ? 'କୃଷକ ବଂଶାବଳୀ ଓ ଜମି ଭାଗ' : 'Farmer Land Share (PPAS)';
      case 'LEGAL_HEIR_ENQUIRY':
        return language === 'or' ? 'ଉତ୍ତରାଧିକାରୀ ତଦନ୍ତ' : 'Legal Heir Certificate Enquiry';
      case 'DISASTER_MANAGEMENT':
        return language === 'or' ? 'ବିପର୍ଯ୍ୟୟ ଓ ଗୃହ କ୍ଷତିଗ୍ରସ୍ତ ତଦନ୍ତ' : 'Disaster House Damage & Relief';
    }
  };

  return (
    <header className="h-14 bg-[#1E40AF] text-white flex items-center justify-between px-3 sm:px-6 shadow-md z-40 sticky top-0 print:hidden">
      {/* Left Brand & Module Switcher */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={onGoToDashboard}
        >
          <div className="w-8 h-8 bg-white/20 rounded flex items-center justify-center font-bold text-sm text-white shadow-sm border border-white/20">
            OR
          </div>
          <div className="flex flex-col">
            <h1 className="text-xs sm:text-sm font-bold tracking-tight leading-tight">
              {language === 'or'
                ? 'ଓଡ଼ିଶା ରାଜସ୍ୱ ଓ ବିପର୍ଯ୍ୟୟ ପରିଚାଳନା ପୋର୍ଟାଲ'
                : 'Odisha Revenue & Field Operations Portal'}
            </h1>
            <span className="text-[10px] text-amber-300 font-medium opacity-90 hidden sm:block">
              Cloud Synced Suite for Revenue Inspectors & Field Officers
            </span>
          </div>
        </div>

        {/* Module Switcher Dropdown */}
        <div className="relative hidden md:block">
          <button
            onClick={() => setShowModuleMenu(!showModuleMenu)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-900/80 hover:bg-blue-950 border border-blue-400/40 text-xs font-semibold transition"
          >
            <Layers className="w-3.5 h-3.5 text-amber-300" />
            <span>{getModuleLabel(activeModule)}</span>
            <ChevronDown className="w-3 h-3 text-blue-200" />
          </button>

          {showModuleMenu && (
            <div className="absolute left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-slate-800 text-xs font-semibold z-50">
              <button
                onClick={() => {
                  onSelectModule('KHANA_2');
                  setShowModuleMenu(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between ${
                  activeModule === 'KHANA_2' ? 'text-blue-600 bg-blue-50/50' : ''
                }`}
              >
                <span>ଖାନା-୨ ସଂଶୋଧନ (Khana-2)</span>
                {activeModule === 'KHANA_2' && <span className="w-2 h-2 rounded-full bg-blue-600"></span>}
              </button>

              <button
                onClick={() => {
                  onSelectModule('COLUMN_2_CAMP');
                  setShowModuleMenu(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-indigo-50 flex items-center justify-between ${
                  activeModule === 'COLUMN_2_CAMP' ? 'text-indigo-700 bg-indigo-50/50' : ''
                }`}
              >
                <span>ଖାନା-୨ କ୍ୟାମ୍ପ (Column 2 Camp · Annx-II)</span>
                {activeModule === 'COLUMN_2_CAMP' && <span className="w-2 h-2 rounded-full bg-indigo-600"></span>}
              </button>

              <button type="button" onClick={() => { onSelectModule('ENCROACHMENT'); setShowModuleMenu(false); }}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-indigo-50">
                G Form &amp; Register IV
              </button>
              <button type="button" onClick={() => { onSelectModule('DISPATCH'); setShowModuleMenu(false); }}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-indigo-50">
                Dispatch &amp; Letters
              </button>
              <button
                onClick={() => {
                  onSelectModule('FARMER_VERIFICATION');
                  setShowModuleMenu(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-emerald-50 flex items-center justify-between ${
                  activeModule === 'FARMER_VERIFICATION' ? 'text-emerald-600 bg-emerald-50/50' : ''
                }`}
              >
                <span>କୃଷକ ବଂଶାବଳୀ ଓ ଜମି ଭାଗ (PPAS)</span>
                {activeModule === 'FARMER_VERIFICATION' && <span className="w-2 h-2 rounded-full bg-emerald-600"></span>}
              </button>

              <button
                onClick={() => {
                  onSelectModule('LEGAL_HEIR_ENQUIRY');
                  setShowModuleMenu(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-amber-50 flex items-center justify-between ${
                  activeModule === 'LEGAL_HEIR_ENQUIRY' ? 'text-amber-700 bg-amber-50/50' : ''
                }`}
              >
                <span>ଉତ୍ତରାଧିକାରୀ ପ୍ରମାଣପତ୍ର ତଦନ୍ତ (Legal Heir)</span>
                {activeModule === 'LEGAL_HEIR_ENQUIRY' && <span className="w-2 h-2 rounded-full bg-amber-600"></span>}
              </button>

              <button
                onClick={() => {
                  onSelectModule('DISASTER_MANAGEMENT');
                  setShowModuleMenu(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-rose-50 flex items-center justify-between ${
                  activeModule === 'DISASTER_MANAGEMENT' ? 'text-rose-700 bg-rose-50/50' : ''
                }`}
              >
                <span>ବିପର୍ଯ୍ୟୟ ଓ ଗୃହ କ୍ଷତିଗ୍ରସ୍ତ ତଦନ୍ତ (Disaster Relief)</span>
                {activeModule === 'DISASTER_MANAGEMENT' && <span className="w-2 h-2 rounded-full bg-rose-600"></span>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Controls & Auth Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
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
          <span>{language === 'en' ? 'ଓଡ଼ିଆ' : 'Eng'}</span>
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
