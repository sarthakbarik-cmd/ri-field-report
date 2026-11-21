import React, { useEffect } from 'react';
import {
  FileSignature,
  MapPin,
  Calendar,
  Clock,
  UserPlus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Phone,
  PhoneCall,
  User,
} from 'lucide-react';
import { CaseData, Witness, FieldVerification } from '../../types';
import { getRIProfile } from '../../utils/storage';

interface Step5FieldVerificationProps {
  caseData: CaseData;
  onUpdateVerification: (verification: FieldVerification) => void;
  onNext: () => void;
  onBack: () => void;
  language: 'en' | 'or';
}

export const Step5FieldVerification: React.FC<Step5FieldVerificationProps> = ({
  caseData,
  onUpdateVerification,
  onNext,
  onBack,
  language,
}) => {
  const ver = caseData.verification;
  const doc = caseData.rorDocument;

  // Auto-initialize Place, Date, Time from ROR & system if empty
  const place = ver.place || doc.mouza || doc.village || '';
  const currentDate = ver.date || new Date().toISOString().split('T')[0];
  const currentTime =
    ver.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Auto-populate RI details from profile if currently blank
  useEffect(() => {
    const profile = getRIProfile();
    if (!ver.riName || !ver.riCircle || !ver.letterNo) {
      onUpdateVerification({
        ...ver,
        riName: ver.riName || profile.riName || '',
        riCircle: ver.riCircle || profile.riCircle || '',
        letterNo:
          ver.letterNo ||
          (profile.letterNoPrefix ? `${profile.letterNoPrefix}/${Math.floor(100 + Math.random() * 900)}` : ''),
      });
    }
  }, []);

  const handleSyncFromProfile = () => {
    const profile = getRIProfile();
    onUpdateVerification({
      ...ver,
      riName: profile.riName || ver.riName || '',
      riCircle: profile.riCircle || ver.riCircle || '',
      letterNo: profile.letterNoPrefix
        ? `${profile.letterNoPrefix}/${Math.floor(100 + Math.random() * 900)}`
        : ver.letterNo || '',
    });
  };

  const handleFieldChange = (field: keyof FieldVerification, value: any) => {
    onUpdateVerification({
      ...ver,
      [field]: value,
    });
  };

  // Add Witness
  const handleAddWitness = () => {
    const newWitness: Witness = {
      id: 'wit_' + Date.now(),
      slNo: (ver.witnesses || []).length + 1,
      name: '',
      fatherName: '',
      phone: '',
      address: place ? `At/PO: ${place}` : '',
      signatureStatus: 'Signed',
    };
    onUpdateVerification({
      ...ver,
      witnesses: [...(ver.witnesses || []), newWitness],
    });
  };

  // Remove Witness
  const handleRemoveWitness = (id: string) => {
    const filtered = (ver.witnesses || [])
      .filter((w) => w.id !== id)
      .map((w, idx) => ({ ...w, slNo: idx + 1 }));
    onUpdateVerification({
      ...ver,
      witnesses: filtered,
    });
  };

  // Witness Field Change
  const handleWitnessChange = (id: string, field: keyof Witness, value: any) => {
    const updated = (ver.witnesses || []).map((w) => (w.id === id ? { ...w, [field]: value } : w));
    onUpdateVerification({
      ...ver,
      witnesses: updated,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
            Step 5 of 6
          </span>
          <span className="text-xs text-slate-500">• Field Verification & Witnesses</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          {language === 'or'
            ? 'କ୍ଷେତ୍ର ଯାଞ୍ଚ ଏବଂ ସାକ୍ଷୀ ବିବରଣୀ'
            : 'RI Field Verification & Local Witness Details'}
        </h2>
        <p className="text-sm text-slate-600">
          Place of verification is automatically populated from the verified ROR Mouza. Capture local witness statements and Revenue Inspector verification remarks.
        </p>
      </div>

      {/* Applicant Contact Summary Card */}
      {(caseData.applicantName || caseData.applicantPhone) && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <span className="text-emerald-900 font-bold block text-sm">
                Applicant Contact: {caseData.applicantName || 'Unnamed Applicant'}
                {caseData.applicantRelation && (
                  <span className="text-emerald-700 font-normal text-xs ml-1.5">
                    ({caseData.applicantRelation})
                  </span>
                )}
              </span>
              <span className="text-emerald-700 text-xs flex items-center gap-1 font-mono font-semibold">
                <Phone className="w-3 h-3 inline" />
                {caseData.applicantPhone ? `+91 ${caseData.applicantPhone}` : 'No phone provided'}
                {caseData.alternatePhone && ` • Alt: +91 ${caseData.alternatePhone}`}
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[11px] border border-emerald-300 self-start sm:self-auto">
            Ready for Hearing Notices
          </span>
        </div>
      )}

      {/* Automatic Place, Date, Time & RI Profile Card */}
      <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-md space-y-4">
        <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-2">
          <span>Captured Audit Metadata & RI Authority Details</span>
          <button
            type="button"
            onClick={handleSyncFromProfile}
            className="inline-flex items-center space-x-1 bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded text-[11px] font-semibold transition shadow-sm"
            title="Fetch and update from your saved Officer Profile"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sync from Profile</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-800/80 p-3.5 rounded-lg border border-slate-700 space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <MapPin className="w-4 h-4 text-blue-400" />
              Place of Verification (ମୌଜା)
            </span>
            <input
              type="text"
              value={place}
              onChange={(e) => handleFieldChange('place', e.target.value)}
              className="w-full bg-slate-900 text-white font-bold text-sm px-2.5 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-lg border border-slate-700 space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Calendar className="w-4 h-4 text-emerald-400" />
              Date of Inspection
            </span>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => handleFieldChange('date', e.target.value)}
              className="w-full bg-slate-900 text-white font-bold text-sm px-2.5 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-lg border border-slate-700 space-y-1">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-amber-400" />
              Inspection Time
            </span>
            <input
              type="text"
              value={currentTime}
              onChange={(e) => handleFieldChange('time', e.target.value)}
              className="w-full bg-slate-900 text-white font-bold text-sm px-2.5 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* RI Officer & Circle Details Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-2 border-t border-slate-800">
          <div className="bg-slate-800/80 p-3.5 rounded-lg border border-slate-700 space-y-1">
            <span className="text-slate-400 font-medium">RI Officer Name (ରାଜସ୍ୱ ନିରୀକ୍ଷକ ଙ୍କ ନାମ) *</span>
            <input
              type="text"
              value={ver.riName || ''}
              onChange={(e) => handleFieldChange('riName', e.target.value)}
              placeholder="e.g. Shri Sarthak Barik"
              className="w-full bg-slate-900 text-white font-bold text-sm px-2.5 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-lg border border-slate-700 space-y-1">
            <span className="text-slate-400 font-medium">RI Circle Name (ସର୍କଲ / କାର୍ଯ୍ୟାଳୟ) *</span>
            <input
              type="text"
              value={ver.riCircle || ''}
              onChange={(e) => handleFieldChange('riCircle', e.target.value)}
              placeholder="e.g. Champua RI Circle"
              className="w-full bg-slate-900 text-white font-bold text-sm px-2.5 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="bg-slate-800/80 p-3.5 rounded-lg border border-slate-700 space-y-1">
            <span className="text-slate-400 font-medium">Ref Letter No (ପତ୍ର ସଂ.)</span>
            <input
              type="text"
              value={ver.letterNo || ''}
              onChange={(e) => handleFieldChange('letterNo', e.target.value)}
              placeholder="e.g. 124/RI"
              className="w-full bg-slate-900 text-white font-bold text-sm px-2.5 py-1.5 rounded border border-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Local Witnesses Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-blue-600" />
              Persons Present / Local Witnesses (ସ୍ଥାନୀୟ ସାକ୍ଷୀ)
            </h3>
            <p className="text-xs text-slate-500">
              Record names of local village witnesses present during physical field verification.
            </p>
          </div>

          <button
            onClick={handleAddWitness}
            className="inline-flex items-center space-x-1 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ ADD WITNESS</span>
          </button>
        </div>

        <div className="space-y-3">
          {(ver.witnesses || []).map((wit) => (
            <div
              key={wit.id}
              className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-3 text-xs"
            >
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold flex items-center justify-center shrink-0">
                {wit.slNo}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 w-full">
                <input
                  type="text"
                  placeholder="Witness Full Name *"
                  value={wit.name}
                  onChange={(e) => handleWitnessChange(wit.id, 'name', e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-sm"
                />

                <input
                  type="text"
                  placeholder="Father's Name *"
                  value={wit.fatherName}
                  onChange={(e) => handleWitnessChange(wit.id, 'fatherName', e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm"
                />

                <input
                  type="tel"
                  placeholder="Mobile No. (Optional)"
                  maxLength={10}
                  value={wit.phone || ''}
                  onChange={(e) => handleWitnessChange(wit.id, 'phone', e.target.value.replace(/\D/g, ''))}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-mono"
                />

                <input
                  type="text"
                  placeholder="Village Address"
                  value={wit.address || ''}
                  onChange={(e) => handleWitnessChange(wit.id, 'address', e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <button
                onClick={() => handleRemoveWitness(wit.id)}
                className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {(ver.witnesses || []).length === 0 && (
            <div className="p-6 text-center text-slate-500 border border-dashed border-slate-300 rounded-xl">
              No witnesses added yet. Click "+ ADD WITNESS" to record village witnesses present during inspection.
            </div>
          )}
        </div>
      </div>

      {/* RI Verification Remarks */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
        <h3 className="text-base font-bold text-slate-900">
          Revenue Inspector (RI) Report & Verification Remarks *
        </h3>
        <textarea
          rows={5}
          value={ver.riRemarks}
          onChange={(e) => handleFieldChange('riRemarks', e.target.value)}
          placeholder={`Enter detailed RI inquiry findings, e.g.:
"Conducted on-spot physical verification at Mouza ${doc.mouza || '---'}, Khata No ${doc.khataNumber || '---'}. Verified genealogy trees with local village gentries. The recorded tenant(s) expired and proposed legal heirs are in peaceful possession of the land."`}
          className="w-full p-4 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white leading-relaxed"
        />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm transition flex items-center space-x-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Legal Heirs</span>
        </button>

        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow transition flex items-center space-x-1.5"
        >
          <span>Review & Generate Final Report</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
