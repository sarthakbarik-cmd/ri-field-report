import React from 'react';
import { CheckSquare, Square, Users, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { CaseData } from '../../types';

interface Step3SelectRTsProps {
  caseData: CaseData;
  onUpdateSelectedRTs: (selectedIds: string[]) => void;
  onNext: () => void;
  onBack: () => void;
  language: 'en' | 'or';
}

export const Step3SelectRTs: React.FC<Step3SelectRTsProps> = ({
  caseData,
  onUpdateSelectedRTs,
  onNext,
  onBack,
  language,
}) => {
  const tenants = caseData.recordedTenants;
  const selectedIds = caseData.selectedRTIds || [];

  const handleToggleRT = (id: string) => {
    let updated: string[];
    if (selectedIds.includes(id)) {
      updated = selectedIds.filter((item) => item !== id);
    } else {
      updated = [...selectedIds, id];
    }
    onUpdateSelectedRTs(updated);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === tenants.length) {
      onUpdateSelectedRTs([]);
    } else {
      onUpdateSelectedRTs(tenants.map((t) => t.id));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
            Step 3 of 6
          </span>
          <span className="text-xs text-slate-500">• RT Offline Selection</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          {language === 'or'
            ? 'ଅଫଲାଇନ୍ ସଂଶୋଧନ ଆବଶ୍ୟକ କରୁଥିବା ଖାତାଦାର (RT) ବାଛନ୍ତୁ'
            : 'Select RTs Requiring Offline Khana-2 Update'}
        </h2>
        <p className="text-sm text-slate-600">
          When one recorded tenant in a Khata is updated online but another recorded tenant in the same Khata requires offline processing by the Tahasildar, select <strong>ONLY</strong> those tenants needing offline report creation.
        </p>
      </div>

      {/* RT Selection Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        {/* Counter and Select All toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/70 p-4 rounded-xl border border-blue-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg font-bold text-sm">
              {selectedIds.length} / {tenants.length}
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">
                {selectedIds.length} Recorded Tenant(s) Selected for Offline Update
              </div>
              <div className="text-xs text-slate-600">
                Legal heir sections will be automatically created for selected tenants in the next step.
              </div>
            </div>
          </div>

          <button
            onClick={handleSelectAll}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded text-xs font-semibold shadow-sm transition shrink-0"
          >
            {selectedIds.length === tenants.length ? 'Deselect All' : 'Select All RTs'}
          </button>
        </div>

        {/* RT Selection Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-xs text-slate-800">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="p-3 w-12 text-center">Sl</th>
                <th className="p-3">Existing Recorded Tenant (RT) Name</th>
                <th className="p-3">Father / Husband Name</th>
                <th className="p-3 w-24 text-center">Source Page</th>
                <th className="p-3 w-36 text-center">Offline Correction Required</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tenants.map((rt) => {
                const isSelected = selectedIds.includes(rt.id);

                return (
                  <tr
                    key={rt.id}
                    onClick={() => handleToggleRT(rt.id)}
                    className={`cursor-pointer transition ${
                      isSelected ? 'bg-blue-50/80 font-semibold' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="p-3.5 text-center font-bold text-slate-500">{rt.serialNo}</td>

                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 text-sm">{rt.name}</div>
                      {rt.status && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border">
                          {rt.status}
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 text-slate-700">{rt.fatherOrHusbandName || '-'}</td>

                    <td className="p-3.5 text-center font-mono text-slate-500">
                      Pg {rt.sourcePage || 1}
                    </td>

                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleRT(rt.id);
                        }}
                        className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <CheckSquare className="w-4 h-4" />
                            <span>SELECTED ✓</span>
                          </>
                        ) : (
                          <>
                            <Square className="w-4 h-4 text-slate-400" />
                            <span>NOT SELECTED</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {tenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No recorded tenants found in ROR. Please go back to Step 2 and verify tenant records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Validation Warning if 0 RTs selected */}
        {selectedIds.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Please select at least one recorded tenant requiring offline Khana-2 update to proceed.
            </span>
          </div>
        )}

        {/* Navigation Actions */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm transition flex items-center space-x-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to ROR Verification</span>
          </button>

          <button
            onClick={onNext}
            disabled={selectedIds.length === 0}
            className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow transition flex items-center space-x-1.5"
          >
            <span>Proceed to Legal Heir Entry</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
