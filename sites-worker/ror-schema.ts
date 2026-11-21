    export const rorPrompt = `You are an expert document extraction engine for Odisha Record of Rights (ROR) documents.
Analyze the entire attached ROR PDF.
This is an official land/revenue record (khatian / patta) from Odisha, India.

Your task is EXTRACTION ONLY.
Do not provide explanations.
Do not infer missing information.
Do not guess.
Read both English and Odia text carefully.
Preserve Odia names exactly as they appear in the document (do not transliterate unless necessary).

Identify the complete recorded tenant (RT - Recorded Tenant / ଖାତାଦାର / ସତ୍ତ୍ୱାଧିକାରୀ) list.
For each recorded tenant identify the serial number, name, father/husband name if visible, and source page.

Extract the ROR's:
- district (ଜିଲ୍ଲା)
- tahasil (ତହସିଲ)
- mouza/village (ମୌଜା / ଗ୍ରାମ)
- thana (ଥାନା / ଥାନା ନଂ)
- khata/khatian number (ଖାତା ନଂ)
- total rakba/area (ମୋଟ ରକବା / ଜମିର ପରିମାଣ e.g. "Ac. 2.450" or "1.200 Hectares")
- plot details (plotNo / ପ୍ଲଟ ନଂ, kisam / କିସମ e.g. Sarada/Gharabari, area / ରକବା)
- relevant remarks (ମନ୍ତବ୍ୟ)

Tables may span multiple pages.
Do not omit rows.
Do not merge two different tenants.
Do not split one tenant into two tenants.

If a value is unclear or unreadable, return null and place the field name in uncertainFields.
Supply confidence scores (between 0.0 and 1.0) for extracted recorded tenants.

Return ONLY the structured JSON.`;

    export const rorResponseSchema = {
      type: 'OBJECT',
      properties: {
        document: {
          type: 'OBJECT',
          properties: {
            district: { type: 'STRING', description: 'District name in Odisha' },
            tahasil: { type: 'STRING', description: 'Tahasil name' },
            mouza: { type: 'STRING', description: 'Mouza / Village name' },
            village: { type: 'STRING', description: 'Village name if distinct' },
            thana: { type: 'STRING', description: 'Thana name or number' },
            khataNumber: { type: 'STRING', description: 'Khata / Khatian Number' },
            totalRakba: { type: 'STRING', description: 'Total Area / Rakba e.g. Ac 1.500' },
            sourceFileName: { type: 'STRING' },
            pageCount: { type: 'INTEGER', description: 'Total pages in document' },
          },
          required: ['district', 'tahasil', 'mouza', 'khataNumber', 'totalRakba'],
        },
        recordedTenants: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              serialNo: { type: 'INTEGER' },
              name: { type: 'STRING', description: 'Recorded tenant name in Odia or English' },
              fatherOrHusbandName: { type: 'STRING', description: 'Father or husband name' },
              status: { type: 'STRING', description: 'Status e.g. Stitiban, Nijo Chas, etc.' },
              sourcePage: { type: 'INTEGER' },
              confidence: { type: 'NUMBER', description: 'Confidence between 0.0 and 1.0' },
            },
            required: ['serialNo', 'name'],
          },
        },
        plots: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              plotNo: { type: 'STRING' },
              kisam: { type: 'STRING' },
              area: { type: 'STRING' },
              sourcePage: { type: 'INTEGER' },
            },
            required: ['plotNo', 'kisam', 'area'],
          },
        },
        remarks: { type: 'STRING', description: 'ROR remarks if any' },
        uncertainFields: {
          type: 'ARRAY',
          items: { type: 'STRING' },
        },
      },
      required: ['document', 'recordedTenants', 'plots'],
    };
