import React, { useState, useEffect } from 'react';
import {
  getAllSavedGenealogies,
  deleteSavedGenealogy,
} from '../../services/rtGenealogyRegistryService';
import { SavedRtGenealogy } from '../../types';
import {
  Users,
  Search,
  Trash2,
  Download,
  Calendar,
  Layers,
  MapPin,
  X,
  CheckCircle2,
  Clock,
  Sparkles,
  GitBranch,
} from 'lucide-react';

interface RtGenealogyVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGenealogy?: (saved: SavedRtGenealogy) => void;
  currentRtName?: string;
}

export const RtGenealogyVaultModal: React.FC<RtGenealogyVaultModalProps> = ({
  isOpen,
  onClose,
  onSelectGenealogy,
  currentRtName,
}) => {
  const [genealogies, setGenealogies] = useState<SavedRtGenealogy[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<SavedRtGenealogy | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
      if (currentRtName) {
        setSearchQuery(currentRtName);
      }
    }
  }, [isOpen, currentRtName]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getAllSavedGenealogies();
      setGenealogies(data);
      if (data.length > 0) {
        setSelectedRecord(data[0]);
      }
    } catch (err) {
      console.error('Error loading genealogies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to remove this saved RT genealogy from vault?')) {
      return;
    }
    await deleteSavedGenealogy(id);
    setGenealogies((prev) => prev.filter((g) => g.id !== id));
    if (selectedRecord?.id === id) {
      setSelectedRecord(null);
    }
  };

  const filteredGenealogies = genealogies.filter((g) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (g.rtName || '').toLowerCase().includes(q) ||
      (g.rtFatherOrHusbandName || '').toLowerCase().includes(q) ||
      (g.mouza || '').toLowerCase().includes(q) ||
      (g.village || '').toLowerCase().includes(q) ||
      (g.tahasil || '').toLowerCase().includes(q) ||
      g.heirs.some((h) => (h.name || '').toLowerCase().includes(q))
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg leading-snug">
                  Master RT Genealogy Registry (ବଂଶାବଳୀ ଭଣ୍ଡାର)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Cross-Khata & Module Sync
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Reuse and import legal heir genealogies tagged by Recorded Tenant across Khatas and modules
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Left List + Right Detail Preview */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Panel: Search & List */}
          <div className="w-full md:w-5/12 border-r border-slate-200 flex flex-col bg-slate-50">
            {/* Search Input */}
            <div className="p-3 border-b border-slate-200 bg-white">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search RT, Father name, or Heir name..."
                  className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex justify-between items-center mt-2 px-1 text-[11px] text-slate-500">
                <span>{filteredGenealogies.length} saved genealogy records</span>
                {currentRtName && (
                  <span className="text-indigo-600 font-semibold truncate max-w-[150px]">
                    Filter: {currentRtName}
                  </span>
                )}
              </div>
            </div>

            {/* List View */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading saved trees...</div>
              ) : filteredGenealogies.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <GitBranch className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500 font-semibold">No saved RT genealogies found</p>
                  <p className="text-[11px] text-slate-400">
                    When you enter legal heirs in Khana-2 or PPAS, they are automatically saved here for instant reuse.
                  </p>
                </div>
              ) : (
                filteredGenealogies.map((rec) => {
                  const isSelected = selectedRecord?.id === rec.id;
                  return (
                    <div
                      key={rec.id}
                      onClick={() => setSelectedRecord(rec)}
                      className={`p-3 rounded-xl cursor-pointer border transition text-left relative ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-500 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight">
                            {rec.rtName}
                          </h4>
                          <p className="text-[11px] text-slate-600">
                            ପିତା/ସ୍ୱାମୀ: {rec.rtFatherOrHusbandName || '---'}
                          </p>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            rec.sourceModule === 'PPAS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {rec.sourceModule}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3 text-indigo-500" />
                          {rec.totalHeirsCount} Heirs ({rec.livingHeirsCount} living)
                        </span>
                        {rec.mouza && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {rec.mouza}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => handleDelete(rec.id, e)}
                        className="absolute right-2 bottom-2 p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Delete from vault"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Selected Record Preview & Quick Import */}
          <div className="w-full md:w-7/12 flex flex-col bg-white overflow-hidden">
            {selectedRecord ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Preview Header */}
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base text-slate-900">
                        {selectedRecord.rtName}
                      </h4>
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-800 text-[10px] font-bold rounded">
                        [ମୃତ ଖାତା ରୟତ]
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      ପିତା / ସ୍ୱାମୀ: <strong>{selectedRecord.rtFatherOrHusbandName || '---'}</strong>
                      {selectedRecord.mouza && ` • Mouza: ${selectedRecord.mouza}`}
                      {selectedRecord.tahasil && ` • Tahasil: ${selectedRecord.tahasil}`}
                    </p>
                  </div>

                  {onSelectGenealogy && (
                    <button
                      onClick={() => {
                        onSelectGenealogy(selectedRecord);
                        onClose();
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 transition active:scale-95 shrink-0"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>⚡ Import & Apply Tree</span>
                    </button>
                  )}
                </div>

                {/* Heir List Details */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Genealogy Hierarchy ({selectedRecord.heirs.length} Members)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Last Updated: {new Date(selectedRecord.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {selectedRecord.heirs.map((heir, idx) => {
                      const parentHeir = heir.parentHeirId
                        ? selectedRecord.heirs.find((p) => p.id === heir.parentHeirId)
                        : null;

                      return (
                        <div
                          key={heir.id || idx}
                          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                            heir.isDeceased
                              ? 'bg-slate-100/90 border-slate-300 text-slate-600'
                              : 'bg-white border-slate-200 text-slate-900 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <div className="font-bold flex items-center gap-1.5">
                                <span>{heir.name}</span>
                                {heir.isDeceased ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                    † ମୃତ [Pre-deceased]
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    ✓ ଜୀବିତ ୱାରିଶ୍
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Relationship: <strong className="text-slate-700">{heir.relationship}</strong>
                                {parentHeir && (
                                  <span className="text-indigo-600 font-semibold ml-1">
                                    (via Late {parentHeir.name})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right text-[11px] text-slate-500">
                            {heir.phone && <span className="block font-mono">📱 {heir.phone}</span>}
                            {heir.address && (
                              <span className="block text-[10px] text-slate-400 truncate max-w-[180px]">
                                {heir.address}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <Users className="w-12 h-12 text-slate-200 mb-2" />
                <p className="text-xs font-semibold text-slate-500">Select a Recorded Tenant from the list</p>
                <p className="text-[11px] text-slate-400 max-w-sm mt-1">
                  Preview full genealogical hierarchy and import it directly into your current Khata or report.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>💡 Tagged automatically by RT Name & Father's Name across all Khatas</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
