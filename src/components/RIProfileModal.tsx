import React, { useState } from 'react';
import { Shield, Save, X, User, MapPin, FileText, CheckCircle2, Building, Phone, Briefcase, Hash } from 'lucide-react';
import { RIProfile } from '../types';
import { saveRIProfile } from '../utils/storage';
import { deriveCircleTag } from '../utils/dispatchNumberService';
import { useAuth } from '../lib/AuthContext';

interface RIProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: RIProfile;
  onProfileUpdated: (updated: RIProfile) => void;
}

export const RIProfileModal: React.FC<RIProfileModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onProfileUpdated,
}) => {
  const { user, updateProfile } = useAuth();

  const [riName, setRiName] = useState(currentProfile.riName || '');
  const [designation, setDesignation] = useState(currentProfile.designation || 'Revenue Inspector (ରାଜସ୍ୱ ନିରୀକ୍ଷକ)');
  const [riCircle, setRiCircle] = useState(currentProfile.riCircle || '');
  const [tahasil, setTahasil] = useState(currentProfile.tahasil || 'Champua');
  const [district, setDistrict] = useState(currentProfile.district || 'Kendujhar');
  const [officeName, setOfficeName] = useState(currentProfile.officeName || '');
  const [letterNoPrefix, setLetterNoPrefix] = useState(currentProfile.letterNoPrefix || '');
  const [phone, setPhone] = useState(currentProfile.phone || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCircleOrTahasilChange = (newCircle: string, newTahasil: string) => {
    setRiCircle(newCircle);
    setTahasil(newTahasil);
    if (!officeName || officeName.startsWith('Office of the Revenue Inspector')) {
      const circlePart = newCircle ? ` ${newCircle}` : '';
      const tahasilPart = newTahasil ? `, Tahasil: ${newTahasil}` : '';
      setOfficeName(`Office of the Revenue Inspector${circlePart}${tahasilPart}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: RIProfile = {
      riName: riName.trim(),
      designation: designation.trim(),
      riCircle: riCircle.trim(),
      tahasil: tahasil.trim() || 'Champua',
      district: district.trim() || 'Kendujhar',
      officeName: officeName.trim() || (riCircle ? `Office of the Revenue Inspector, ${riCircle}` : ''),
      letterNoPrefix: letterNoPrefix.trim(),
      phone: phone.trim(),
    };

    saveRIProfile(updated);
    onProfileUpdated(updated);

    // Also sync to Firebase User Profile if logged in
    if (user) {
      try {
        await updateProfile({
          name: updated.riName || user.displayName || '',
          riCircle: updated.riCircle,
          tahasil: updated.tahasil || '',
          district: updated.district || '',
          designation: updated.designation || 'RI',
          officeName: updated.officeName,
          letterNoPrefix: updated.letterNoPrefix,
          phone: updated.phone,
        });
      } catch (err) {
        console.warn('Could not sync user profile to cloud:', err);
      }
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
              <Shield className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Official Revenue Officer Profile
              </h3>
              <p className="text-xs text-slate-500">
                Configure your Name, Tahasil, RI Circle & District for auto-populating reports
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedSuccess ? (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto animate-bounce" />
            <h4 className="font-bold text-emerald-900 text-sm">Official Profile Saved Successfully!</h4>
            <p className="text-xs text-emerald-700">
              All modules (Khana-2, Farmer Land Share, OLR 19, Disaster Relief) will now auto-fetch these details.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Officer Name & Designation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  <span>Officer Name (ଅଧିକାରୀଙ୍କ ନାମ) *</span>
                </label>
                <input
                  type="text"
                  required
                  value={riName}
                  onChange={(e) => setRiName(e.target.value)}
                  placeholder="e.g. Shri Sarthak Sarathi Barik"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Designation (ପଦବୀ)</span>
                </label>
                <input
                  type="text"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Revenue Inspector / ରାଜସ୍ୱ ନିରୀକ୍ଷକ"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {/* RI Circle & Tahasil */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>RI Circle / ସର୍କଲ *</span>
                </label>
                <input
                  type="text"
                  required
                  value={riCircle}
                  onChange={(e) => handleCircleOrTahasilChange(e.target.value, tahasil)}
                  placeholder="e.g. Chimila Circle / ଚିମିଳା"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-purple-600" />
                  <span>Tahasil (ତହସିଲ) *</span>
                </label>
                <input
                  type="text"
                  required
                  value={tahasil}
                  onChange={(e) => handleCircleOrTahasilChange(riCircle, e.target.value)}
                  placeholder="e.g. Champua / ଚମ୍ପୁଆ"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>

            {/* District & Office Ref Letter Prefix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  <span>District (ଜିଲ୍ଲା) *</span>
                </label>
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Keonjhar / କେନ୍ଦୁଝର"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Circle Tag / Letter Prefix</span>
                </label>
                <input
                  type="text"
                  value={letterNoPrefix}
                  onChange={(e) => setLetterNoPrefix(e.target.value)}
                  placeholder="e.g. CHI (Defaults to Circle Code)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white uppercase"
                />
              </div>
            </div>

            {/* Automated Dispatch Numbering Preview Badge */}
            {(() => {
              const circleCode = deriveCircleTag(riCircle, letterNoPrefix);
              return (
                <div className="p-3 bg-slate-900 text-white rounded-xl text-xs space-y-2 shadow-inner border border-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
                    <span className="font-bold text-[11px] text-amber-300 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5" /> Automated Dispatch Numbering Active
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-mono font-bold text-[10px]">
                      TAG: {circleCode}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                    <div className="bg-slate-800/80 p-2 rounded border border-slate-700">
                      <div className="text-[9px] text-slate-400 font-sans uppercase font-bold">Khana-2</div>
                      <div className="text-emerald-400 font-bold">{circleCode}/COL/01</div>
                    </div>
                    <div className="bg-slate-800/80 p-2 rounded border border-slate-700">
                      <div className="text-[9px] text-slate-400 font-sans uppercase font-bold">PPAS Farmer</div>
                      <div className="text-blue-400 font-bold">{circleCode}/FR/01</div>
                    </div>
                    <div className="bg-slate-800/80 p-2 rounded border border-slate-700">
                      <div className="text-[9px] text-slate-400 font-sans uppercase font-bold">Legal Heirs</div>
                      <div className="text-purple-400 font-bold">{circleCode}/LHC/01</div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Full Office Header & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-slate-600" />
                  <span>Official Office Header (କାର୍ଯ୍ୟାଳୟ)</span>
                </label>
                <input
                  type="text"
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  placeholder="e.g. Office of the Revenue Inspector, Chimila"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Official Contact / Mobile (ଫୋନ୍)</span>
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9861000000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 leading-relaxed">
              💡 <strong>Auto-Link Feature</strong>: Once configured, your Name, RI Circle, Tahasil, and District will be automatically fetched when creating new Khana-2 cases, Farmer PPAS land share inquiries, OLR 19(1)(c) reports, and Disaster Relief assessments.
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Save & Apply to System</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
