import { EncroachmentModule } from './components/modules/EncroachmentModule';
import { DispatchModule } from './components/modules/DispatchModule';
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { NewCaseWorkflow } from './components/workflow/NewCaseWorkflow';
import { ReportPDFView } from './components/ReportPDFView';
import { AIExtractionLogModal } from './components/AIExtractionLogModal';
import { RIProfileModal } from './components/RIProfileModal';
import { Khana2Module } from './components/modules/Khana2Module';
import { FarmerVerificationModule } from './components/modules/FarmerVerificationModule';
import { LegalHeirEnquiryModule } from './components/modules/LegalHeirEnquiryModule';
import { DisasterManagementModule } from './components/modules/DisasterManagementModule';
import { Column2CampModule } from './components/modules/Column2CampModule';
import { CaseData, RIProfile, ModuleType } from './types';
import {
  getAllCases,
  getCaseById,
  saveCase,
  deleteCase,
  createNewEmptyCase,
  getRIProfile,
} from './utils/storage';
import {
  saveCloudCase,
  fetchCloudCases,
  deleteCloudCase,
  subscribeToCloudCases,
} from './services/cloudSyncService';
import { useAuth } from './lib/AuthContext';
import { ArrowLeft, Printer } from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const [activeModule, setActiveModule] = useState<ModuleType>(() => window.location.hash === '#dispatch' ? 'DISPATCH' : window.location.hash === '#g-form' ? 'ENCROACHMENT' : 'HOME');
  const [cases, setCases] = useState<CaseData[]>([]);
  const [activeCase, setActiveCase] = useState<CaseData | null>(null);
  const [currentView, setCurrentView] = useState<'dashboard' | 'workflow' | 'report'>('dashboard');
  const [language, setLanguage] = useState<'en' | 'or'>('en');
  const [showAILogModal, setShowAILogModal] = useState(false);
  const [showRIProfileModal, setShowRIProfileModal] = useState(false);
  const [guestProfile, setGuestProfile] = useState<RIProfile>(() => getRIProfile(null));
  const riProfile = user ? getRIProfile(user.uid) : guestProfile;
  const [workflowInitialStep, setWorkflowInitialStep] = useState(1);

  // Real-time Firestore Sync subscription + LocalStorage initial migration
  useEffect(() => {
    if (user) {
      // 1. Initial push of any local offline cases to cloud if not already synced
      const localCases = getAllCases();
      if (localCases.length > 0) {
        localCases.forEach((c) => {
          saveCloudCase(user.uid, c).catch((e) => console.warn('Syncing existing case:', e));
        });
      }

      // 2. Real-time Firestore Listener
      const unsubscribe = subscribeToCloudCases(user.uid, (cloudCases) => {
        if (cloudCases.length > 0) {
          setCases(cloudCases);
        } else {
          setCases(getAllCases());
        }
      });

      return () => unsubscribe();
    } else {
      // Offline fallback: load from LocalStorage
      setCases(getAllCases());
    }
  }, [user]);

  const refreshCases = async () => {
    if (user) {
      try {
        const cloudList = await fetchCloudCases(user.uid);
        if (cloudList.length > 0) {
          setCases(cloudList);
          return;
        }
      } catch (err) {
        console.warn('Failed to load cloud cases, falling back to local storage:', err);
      }
    }
    const loaded = getAllCases();
    setCases(loaded);
  };

  const handleRIProfileUpdated = (updated: RIProfile) => {
    if (!user) setGuestProfile(updated);
    if (activeCase) {
      const updatedCase: CaseData = {
        ...activeCase,
        verification: {
          ...activeCase.verification,
          riName: updated.riName,
          riCircle: updated.riCircle,
        },
      };
      saveCase(updatedCase);
      if (user) {
        saveCloudCase(user.uid, updatedCase);
      }
      setActiveCase(updatedCase);
      refreshCases();
    }
  };

  const handleNewCase = () => {
    const fresh = createNewEmptyCase();
    const saved = saveCase(fresh);
    if (user) {
      saveCloudCase(user.uid, saved);
    }
    setActiveCase(saved);
    setWorkflowInitialStep(1);
    setCurrentView('workflow');
    refreshCases();
  };

  const handleOpenCase = (id: string, step: number = 2) => {
    const found = cases.find((c) => c.id === id) || getCaseById(id);
    if (found) {
      setActiveCase(found);
      setWorkflowInitialStep(step);
      setCurrentView('workflow');
    }
  };

  const handleViewReport = (id: string) => {
    const found = cases.find((c) => c.id === id) || getCaseById(id);
    if (found) {
      setActiveCase(found);
      setCurrentView('report');
    }
  };

  const handleDeleteCase = async (id: string) => {
    deleteCase(id);
    if (user) {
      try {
        await deleteCloudCase(user.uid, id);
      } catch (err) {
        console.error('Failed to delete cloud case:', err);
      }
    }
    if (activeCase?.id === id) {
      setActiveCase(null);
      setCurrentView('dashboard');
    }
    refreshCases();
  };

  const handleSelectModule = (mod: ModuleType) => {
    if (mod === 'DISPATCH' || mod === 'ENCROACHMENT' || ['#dispatch', '#g-form'].includes(window.location.hash)) {
      const url = new URL(window.location.href);
      url.hash = mod === 'DISPATCH' ? 'dispatch' : mod === 'ENCROACHMENT' ? 'g-form' : '';
      window.history.replaceState(null, '', url);
    }
    setActiveModule(mod);
    setCurrentView('dashboard');
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navigation Bar */}
      <Header
        currentView={currentView}
        activeModule={activeModule}
        onSelectModule={handleSelectModule}
        activeCaseId={activeCase?.id}
        language={language}
        riProfile={riProfile}
        onToggleLanguage={() => setLanguage(language === 'en' ? 'or' : 'en')}
        onNewCase={handleNewCase}
        onGoToDashboard={() => handleSelectModule('HOME')}
        onOpenAILog={activeCase ? () => setShowAILogModal(true) : undefined}
        onOpenRIProfile={() => setShowRIProfileModal(true)}
      />

      {/* Main View Router */}
      <div className="flex-1">
        {/* HOME PORTAL / ALL MODULES OVERVIEW */}
        {activeModule === 'HOME' && (
          <Dashboard
            cases={cases}
            riProfile={riProfile}
            onNewCase={() => {
              handleNewCase();
              setActiveModule('KHANA_2');
            }}
            onOpenCase={(id, step) => {
              handleOpenCase(id, step);
              setActiveModule('KHANA_2');
            }}
            onViewReport={(id) => {
              handleViewReport(id);
              setActiveModule('KHANA_2');
            }}
            onDeleteCase={handleDeleteCase}
            onSelectModule={handleSelectModule}
            onOpenRIProfile={() => setShowRIProfileModal(true)}
            language={language}
          />
        )}

        {/* MODULE 1: KHANA-2 RECORD CORRECTION */}
        {activeModule === 'KHANA_2' && (
          <>
            {currentView === 'dashboard' && (
              <Khana2Module
                cases={cases}
                onNewCase={handleNewCase}
                onOpenCase={handleOpenCase}
                onViewReport={handleViewReport}
                onDeleteCase={handleDeleteCase}
                onBackToDashboard={() => setActiveModule('HOME')}
                language={language}
              />
            )}

            {currentView === 'workflow' && activeCase && (
              <NewCaseWorkflow
                caseData={activeCase}
                onUpdateCase={(updated) => {
                  saveCase(updated);
                  if (user) {
                    saveCloudCase(user.uid, updated);
                  }
                  setActiveCase(updated);
                  refreshCases();
                }}
                onFinishCase={() => {
                  setCurrentView('dashboard');
                  refreshCases();
                }}
                language={language}
                initialStep={workflowInitialStep}
              />
            )}

            {currentView === 'report' && activeCase && (
              <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 print:p-0 print:m-0 print:space-y-0 print:max-w-none">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Khana-2 Cases</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Consolidated PDF</span>
                    </button>

                    <button
                      onClick={() => handleOpenCase(activeCase.id, 6)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition"
                    >
                      Edit / Export Options
                    </button>
                  </div>
                </div>

                <div className="w-full">
                  <ReportPDFView caseData={activeCase} />
                </div>
              </div>
            )}
          </>
        )}

        {/* MODULE 2: FARMER VERIFICATION & SUCCESSION LAND SHARE (PPAS) */}
        {activeModule === 'FARMER_VERIFICATION' && (
          <FarmerVerificationModule
            onBackToDashboard={() => setActiveModule('HOME')}
            language={language}
          />
        )}

        {/* MODULE 3: LEGAL HEIR CERTIFICATE ENQUIRY */}
        {activeModule === 'LEGAL_HEIR_ENQUIRY' && (
          <LegalHeirEnquiryModule
            onBackToDashboard={() => setActiveModule('HOME')}
            language={language}
          />
        )}

        {/* MODULE 4: DISASTER MANAGEMENT & HOUSE DAMAGE VERIFICATION */}
        {activeModule === 'DISASTER_MANAGEMENT' && (
          <DisasterManagementModule
            onBackToHome={() => setActiveModule('HOME')}
          />
        )}

        {/* COLUMN 2 CAMP: ANNEXURE-II FIELD COLLECTION & SIGNATURES */}
        {activeModule === 'ENCROACHMENT' && !loading && <div key={user?.uid || 'guest'}>
          <EncroachmentModule profile={riProfile} onSignatures={() => handleSelectModule('DISPATCH')} />
        </div>}
        {activeModule === 'DISPATCH' && <div key={user?.uid || 'guest'}><DispatchModule profile={riProfile} /></div>}

        {activeModule === 'COLUMN_2_CAMP' && (
          <Column2CampModule
            onBackToDashboard={() => setActiveModule('HOME')}
            onOpenInKhana2={(caseId) => {
              setActiveModule('KHANA_2');
              refreshCases();
              handleOpenCase(caseId, 4);
            }}
            language={language}
          />
        )}
      </div>

      {/* AI Extraction Log Debug Modal */}
      {activeCase && (
        <AIExtractionLogModal
          isOpen={showAILogModal}
          onClose={() => setShowAILogModal(false)}
          caseData={activeCase}
        />
      )}

      {/* RI Profile Settings Modal */}
      {showRIProfileModal && !loading && <div key={user?.uid || 'guest'}><RIProfileModal
        isOpen
        onClose={() => setShowRIProfileModal(false)}
        currentProfile={riProfile}
        onProfileUpdated={handleRIProfileUpdated}
      /></div>}

      {/* System Footer */}
      <footer className="h-8 bg-slate-800 text-slate-400 text-[10px] flex items-center justify-between px-4 sm:px-6 mt-auto border-t border-slate-700 print:hidden">
        <div className="flex gap-4">
          <span>System Date: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Module: {activeModule} (Odisha Revenue Suite)</span>
        </div>
        <div className="flex gap-3 uppercase tracking-tight">
          <span className="truncate">Revenue Field Operations Suite</span>
          <span className="text-slate-600 hidden md:inline">|</span>
          <span className="hidden md:inline font-semibold text-amber-300">Created by Sarthak</span>
        </div>
      </footer>
    </div>
  );
}
