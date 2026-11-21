import React, { useState } from 'react';
import { CaseData, RORExtractionResult, OfflineCorrection, FieldVerification } from '../../types';
import { WORKFLOW_STEPS, WorkflowProgressBar } from './WorkflowProgressBar';
import { Step1UploadROR } from './Step1UploadROR';
import { Step2VerifyROR } from './Step2VerifyROR';
import { Step3SelectRTs } from './Step3SelectRTs';
import { Step4LegalHeirs } from './Step4LegalHeirs';
import { Step5FieldVerification } from './Step5FieldVerification';
import { Step6ReviewReport } from './Step6ReviewReport';
import { generateCaseId, saveCase } from '../../utils/storage';

interface NewCaseWorkflowProps {
  caseData: CaseData;
  onUpdateCase: (updated: CaseData) => void;
  onFinishCase: () => void;
  language: 'en' | 'or';
  initialStep?: number;
}

export const NewCaseWorkflow: React.FC<NewCaseWorkflowProps> = ({
  caseData,
  onUpdateCase,
  onFinishCase,
  language,
  initialStep = 1,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(initialStep);
  const [maxReachedStep, setMaxReachedStep] = useState<number>(initialStep);

  const goToStep = (step: number) => {
    setCurrentStep(step);
    if (step > maxReachedStep) setMaxReachedStep(step);
  };

  // Helper to persist partial updates
  const handlePartialUpdate = (updates: Partial<CaseData>) => {
    let newCase = { ...caseData, ...updates };

    // Automatically update Case ID if draft ID and doc fields exist
    if (
      newCase.rorDocument.tahasil &&
      newCase.rorDocument.mouza &&
      newCase.rorDocument.khataNumber &&
      newCase.id.includes('DRAFT')
    ) {
      newCase.id = generateCaseId(
        newCase.rorDocument.tahasil,
        newCase.rorDocument.mouza,
        newCase.rorDocument.khataNumber
      );
    }

    const saved = saveCase(newCase);
    onUpdateCase(saved);
  };

  // Step 1 Success Handler
  const handleExtractionSuccess = (
    result: RORExtractionResult,
    rawJsonString: string,
    pdfBase64: string,
    fileName: string
  ) => {
    const doc = result.document;
    const tenants = (result.recordedTenants || []).map((rt, idx) => ({
      ...rt,
      id: 'rt_' + Date.now() + '_' + idx,
      serialNo: rt.serialNo || idx + 1,
    }));

    const plots = (result.plots || []).map((p, idx) => ({
      ...p,
      id: 'plot_' + Date.now() + '_' + idx,
    }));

    // Generate real Case ID
    const newCaseId = generateCaseId(doc.tahasil, doc.mouza, doc.khataNumber);

    const updatedCase: CaseData = {
      ...caseData,
      id: caseData.id.includes('DRAFT') ? newCaseId : caseData.id,
      pdfBase64,
      pdfFileName: fileName,
      rorDocument: {
        district: doc.district || '',
        tahasil: doc.tahasil || '',
        mouza: doc.mouza || doc.village || '',
        village: doc.village || doc.mouza || '',
        thana: doc.thana || '',
        khataNumber: doc.khataNumber || '',
        totalRakba: doc.totalRakba || '',
        sourceFileName: fileName,
        pageCount: doc.pageCount || 1,
      },
      recordedTenants: tenants,
      plots,
      remarks: result.remarks || '',
      uncertainFields: result.uncertainFields || [],
      selectedRTIds: tenants.slice(0, 1).map((t) => t.id), // Default select first RT for convenience
      verification: {
        ...caseData.verification,
        place: doc.mouza || doc.village || '',
      },
      aiExtractionLog: {
        timestamp: new Date().toISOString(),
        modelUsed: 'gemini-3.1-flash-lite',
        rawResponseJson: rawJsonString,
        uncertainFieldsCount: (result.uncertainFields || []).length,
      },
    };

    saveCase(updatedCase);
    onUpdateCase(updatedCase);
    goToStep(2);
  };

  // Manual Entry fallback
  const handleManualEntry = () => {
    goToStep(2);
  };

  return (
    <div className="pb-12 space-y-6">
      {/* Workflow Progress Indicator Bar */}
      <WorkflowProgressBar
        currentStep={currentStep}
        onSelectStep={goToStep}
        maxReachedStep={maxReachedStep}
      />

      {/* Workflow Step Views */}
      <main className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {currentStep === 1 && (
          <Step1UploadROR
            caseData={caseData}
            onExtractionSuccess={handleExtractionSuccess}
            onManualEntry={handleManualEntry}
            language={language}
          />
        )}

        {currentStep === 2 && (
          <Step2VerifyROR
            caseData={caseData}
            onUpdateCaseData={handlePartialUpdate}
            onNext={() => goToStep(3)}
            language={language}
          />
        )}

        {currentStep === 3 && (
          <Step3SelectRTs
            caseData={caseData}
            onUpdateSelectedRTs={(selectedIds) => handlePartialUpdate({ selectedRTIds: selectedIds })}
            onNext={() => goToStep(4)}
            onBack={() => goToStep(2)}
            language={language}
          />
        )}

        {currentStep === 4 && (
          <Step4LegalHeirs
            caseData={caseData}
            onUpdateCorrections={(corrections) => handlePartialUpdate({ offlineCorrections: corrections })}
            onUpdateCaseData={handlePartialUpdate}
            onNext={() => goToStep(5)}
            onBack={() => goToStep(3)}
            language={language}
          />
        )}

        {currentStep === 5 && (
          <Step5FieldVerification
            caseData={caseData}
            onUpdateVerification={(verification) => handlePartialUpdate({ verification })}
            onNext={() => goToStep(6)}
            onBack={() => goToStep(4)}
            language={language}
          />
        )}

        {currentStep === 6 && (
          <Step6ReviewReport
            caseData={caseData}
            onEditStep={(step) => goToStep(step)}
            onCompleteCase={() => {
              handlePartialUpdate({
                status: 'Completed',
                verifiedAt: new Date().toISOString(),
              });
              onFinishCase();
            }}
            language={language}
          />
        )}
      </main>
    </div>
  );
};
