export function createSampleRORPdf(): string {
  // Simple PDF generator header for demo fixture
  const pdfString = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kinds [3 0 R] /Count 1 /Kids [3 0 R]>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>> >> endobj
4 0 obj <</Length 680>>
stream
BT
/F1 16 Tf
50 800 TD
(ODISHA REVENUE & DISASTER MANAGEMENT DEPARTMENT) Tj
/F1 14 Tf
0 -25 TD
(RECORD OF RIGHTS - KHATIAN / ROR PATTA) Tj
/F1 10 Tf
0 -25 TD
(District: Keonjhar   Tahasil: Champua   Mouza: Indraprastha   Thana No: 12) Tj
0 -15 TD
(Khata No: 49         Total Rakba: Ac. 2.850           Land Category: Stitiban) Tj
0 -25 TD
(--------------------------------------------------------------------------------) Tj
0 -15 TD
(RECORDED TENANTS / KHATADARS:) Tj
0 -15 TD
(1. Baikuntha Mahanta, S/o: Gangadhar Mahanta) Tj
0 -15 TD
(2. Amarendra Nath Mahanta, S/o: Gangadhar Mahanta) Tj
0 -15 TD
(3. Subhashree Mahanta, W/o: Late Rabindra Mahanta) Tj
0 -15 TD
(4. Gurucharan Das, S/o: Bhagaban Das) Tj
0 -25 TD
(--------------------------------------------------------------------------------) Tj
0 -15 TD
(PLOT DETAILS:) Tj
0 -15 TD
(Plot No: 102 | Kisam: Sarada-I | Area: Ac. 1.250) Tj
0 -15 TD
(Plot No: 108 | Kisam: Gharabari | Area: Ac. 0.600) Tj
0 -15 TD
(Plot No: 115 | Kisam: Jalasaya  | Area: Ac. 1.000) Tj
0 -25 TD
(Remarks: Khana-2 Column-2 updated for RT 2 on 2025-04-12. RT 1 & RT 3 pending offline.) Tj
ET
endstream
endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000062 00000 n 
0000000135 00000 n 
0000000271 00000 n 
0000001004 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
1075
%%EOF`;
  return pdfString;
}
