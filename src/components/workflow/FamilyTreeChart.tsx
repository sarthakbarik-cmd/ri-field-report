import React from 'react';
import { RecordedTenant, LegalHeir } from '../../types';
import { Users, UserCheck, Skull, Heart, Award } from 'lucide-react';
import { RevenueLineGenealogyTree, GenericGenealogyNode } from '../common/RevenueLineGenealogyTree';

interface FamilyTreeChartProps {
  recordedTenant: RecordedTenant;
  legalHeirs: LegalHeir[];
  title?: string;
  isPrintVersion?: boolean;
}

export const FamilyTreeChart: React.FC<FamilyTreeChartProps> = ({
  recordedTenant,
  legalHeirs,
  title,
  isPrintVersion = false,
}) => {
  // Direct heirs (Generation 1 under Recorded Tenant: Sons, Daughters, Surviving Spouses)
  const directHeirs = legalHeirs.filter(
    (h) => !h.parentHeirId || !legalHeirs.some((p) => p.id === h.parentHeirId)
  );

  // Helper to fetch children belonging to a specific parent node
  const getSubHeirs = (parentId: string) =>
    legalHeirs.filter((h) => h.parentHeirId === parentId);

  // Map to generic nodes for RevenueLineGenealogyTree
  const genericNodes: GenericGenealogyNode[] = legalHeirs.map((h) => ({
    id: h.id,
    name: h.name,
    relationship: h.relationship,
    isDeceased: h.isDeceased,
    parentHeirId: h.parentHeirId,
    fatherOrHusbandName: h.fatherOrHusbandName,
    age: h.age,
    isMinor: h.isMinor,
  }));

  // Relationship styling badge helper for interactive UI
  const getRelationshipBadgeStyle = (rel: string, isDeceased?: boolean) => {
    if (isDeceased) {
      return 'bg-slate-200 text-slate-800 border-slate-400';
    }
    const r = (rel || '').toLowerCase();
    if (
      r.includes('wife') ||
      r.includes('widow') ||
      r.includes('ସ୍ତ୍ରୀ') ||
      r.includes('ବୋହୂ') ||
      r.includes('daughter-in-law')
    ) {
      return 'bg-pink-100 text-pink-900 border-pink-300';
    }
    if (r.includes('son') || r.includes('ପୁଅ') || r.includes('ନାତି') || r.includes('grandson')) {
      return 'bg-blue-100 text-blue-900 border-blue-300';
    }
    if (r.includes('daughter') || r.includes('ଝିଅ') || r.includes('ନାତୁଣୀ') || r.includes('granddaughter')) {
      return 'bg-purple-100 text-purple-900 border-purple-300';
    }
    return 'bg-emerald-100 text-emerald-900 border-emerald-300';
  };

  // ==================== RECURSIVE BRANCH RENDERER (INTERACTIVE UI) ====================
  const renderInteractiveBranch = (heir: LegalHeir, depth: number = 1): React.ReactNode => {
    const children = getSubHeirs(heir.id);
    const isDeceased = heir.isDeceased;

    return (
      <div key={heir.id} className="flex flex-col items-center flex-1 px-1.5 sm:px-2.5 min-w-[150px] max-w-[280px]">
        {/* Node Card for Interactive View */}
        <div
          className={`relative rounded-xl p-3 text-left w-full shadow-sm transition ${
            isDeceased
              ? 'bg-slate-100/95 border-2 border-dashed border-slate-400'
              : 'bg-white border border-slate-300 hover:border-blue-500 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] font-mono text-slate-500 font-bold">
              L{depth} #{heir.slNo || ''}
            </span>
            <div>
              {isDeceased ? (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-400 flex items-center gap-0.5">
                  <Skull className="w-3 h-3 text-slate-600" />
                  ମୃତ [Deceased]
                </span>
              ) : (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getRelationshipBadgeStyle(
                    heir.relationship
                  )}`}
                >
                  {heir.relationship}
                </span>
              )}
            </div>
          </div>

          <div>
            <h6 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1">
              {isDeceased ? (
                <span className="text-slate-500 font-bold">† Late</span>
              ) : (
                <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              )}
              <span>{heir.name || '---'}</span>
            </h6>

            <p className="text-[11px] text-slate-600 mt-0.5">
              <span className="text-slate-400">ପିତା/ସ୍ୱାମୀ:</span>{' '}
              <strong>{heir.fatherOrHusbandName || recordedTenant.name}</strong>
            </p>
          </div>
        </div>

        {/* Recursive Child Branches */}
        {children.length > 0 && (
          <div className="w-full flex flex-col items-center pt-2">
            {/* Stem Line down from parent */}
            <div className="w-0.5 h-4 bg-slate-400"></div>

            {/* Horizontal Branch Bar */}
            <div className="relative w-full flex justify-center items-start pt-2">
              {children.length > 1 && (
                <div
                  className="absolute top-0 h-0.5 bg-slate-400"
                  style={{
                    left: `${100 / (children.length * 2)}%`,
                    right: `${100 / (children.length * 2)}%`,
                  }}
                ></div>
              )}

              {children.map((child) => (
                <div key={child.id} className="flex flex-col items-center flex-1">
                  <div className="w-0.5 h-2 bg-slate-400"></div>
                  <div className="text-slate-500 text-[9px] -mt-1 font-bold">↓</div>
                  {renderInteractiveBranch(child, depth + 1)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==================== PRINT / PDF FORMAT ====================
  if (isPrintVersion) {
    return (
      <RevenueLineGenealogyTree
        rootName={recordedTenant.name}
        rootSubtitle="[ମୃତ ଖାତା ରୟତ / Deceased RT]"
        rootDetails={recordedTenant.fatherOrHusbandName ? `ପିତା/ସ୍ୱାମୀ: ${recordedTenant.fatherOrHusbandName}` : undefined}
        nodes={genericNodes}
        isPrintVersion={true}
        enableStagger={true}
      />
    );
  }

  // ==================== INTERACTIVE UI FORMAT ====================
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-4 sm:p-6 space-y-6 shadow-sm">
      {/* Chart Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-[#1E40AF] text-white flex items-center justify-center font-bold text-xs shadow">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900">
              {title || `ବଂଶାବଳୀ ଚାର୍ଟ (Multi-Generation Genealogy Tree)`}
            </h4>
            <p className="text-[11px] text-slate-500">
              ମୃତ ଖାତା ରୟତ ଙ୍କ ବଂଶାବଳୀ ସଂରଚନା (Displays true multi-tiered fanning branches across Generation 1, 2, 3 & 4)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-[11px]">
          <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span> Pre-deceased Link [ମୃତ]
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Living Legal Heir [ଜୀବିତ ୱାରିଶ୍]
          </span>
        </div>
      </div>

      {/* Visual Family Tree Flowchart */}
      <div className="flex flex-col items-center space-y-4 py-2 overflow-x-auto">
        {/* ROOT NODE: Deceased Recorded Tenant */}
        <div className="relative group max-w-sm w-full">
          <div className="bg-slate-900 text-white rounded-xl p-4 text-center border-2 border-slate-800 shadow-md">
            <div className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white mb-1 uppercase tracking-wider">
              [ମୃତ ଖାତା ରୟତ / Deceased RT]
            </div>
            <h5 className="font-bold text-base text-amber-300">
              {recordedTenant.name}
            </h5>
            <p className="text-xs text-slate-300">
              ପିତା / ସ୍ୱାମୀ: {recordedTenant.fatherOrHusbandName || '---'}
            </p>
            {recordedTenant.residence && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                ସାକିନ: {recordedTenant.residence}
              </p>
            )}
          </div>
        </div>

        {/* Vertical Connecting Stem Line */}
        <div className="flex flex-col items-center">
          <div className="w-0.5 h-6 bg-slate-400"></div>
          <div className="w-3 h-3 rounded-full bg-slate-700 border-2 border-white shadow-sm -mt-1"></div>
        </div>

        {/* CHILD NODES & MULTI-TIERED BRANCHES */}
        {directHeirs.length > 0 ? (
          <div className="w-full overflow-x-auto pb-4">
            <div className="relative w-full flex justify-center items-start min-w-[600px] px-4">
              {/* Horizontal Branch Line for multiple direct heirs */}
              {directHeirs.length > 1 && (
                <div
                  className="absolute top-0 h-0.5 bg-slate-400"
                  style={{
                    left: `${100 / (directHeirs.length * 2)}%`,
                    right: `${100 / (directHeirs.length * 2)}%`,
                  }}
                ></div>
              )}

              {directHeirs.map((heir) => (
                <div key={heir.id} className="flex flex-col items-center flex-1">
                  <div className="w-0.5 h-3 bg-slate-400"></div>
                  <div className="text-slate-500 text-[10px] -mt-1 font-bold">↓</div>
                  {renderInteractiveBranch(heir, 1)}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 border border-dashed border-slate-300 rounded-lg text-center text-xs text-slate-400 italic w-full max-w-md">
            No legal heir genealogy nodes entered yet.
          </div>
        )}
      </div>
    </div>
  );
};
