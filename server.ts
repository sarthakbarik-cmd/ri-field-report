import express, { Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { rorPrompt, rorResponseSchema } from './sites-worker/ror-schema';
import { createSampleRORPdf } from './sites-worker/sample-ror';

dotenv.config();

const app = express();
const PORT = process.env.NODE_ENV === 'production' ? Number(process.env.PORT) || 3000 : 3000;

// Configurable Gemini model alias or name
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const FALLBACK_MODEL = 'gemini-3.1-flash-lite';

// Multer memory storage for PDF upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are supported for ROR document extraction.'));
    }
  },
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Gemini Client
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Healthcheck endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    system: 'Offline Khana-2 Correction Reporting System',
    geminiModel: GEMINI_MODEL,
    hasApiKey: !!process.env.GEMINI_API_KEY,
  });
});

// Extract ROR from uploaded PDF
app.post('/api/extract-ror', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    let pdfBuffer: Buffer;
    let fileName = 'uploaded_ror.pdf';

    if (req.file) {
      pdfBuffer = req.file.buffer;
      fileName = req.file.originalname;
    } else if (req.body.pdfBase64) {
      const cleanBase64 = req.body.pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      pdfBuffer = Buffer.from(cleanBase64, 'base64');
      if (req.body.fileName) fileName = req.body.fileName;
    } else {
      res.status(400).json({ error: 'No PDF file or pdfBase64 provided in request.' });
      return;
    }

    if (pdfBuffer.length === 0) {
      res.status(400).json({ error: 'Uploaded PDF file is empty.' });
      return;
    }

    if (pdfBuffer.length > 25 * 1024 * 1024) {
      res.status(400).json({ error: 'PDF file size exceeds maximum supported limit (25 MB).' });
      return;
    }

    const ai = getGeminiClient();
    const base64Data = pdfBuffer.toString('base64');


    console.log(`Sending ROR PDF (${fileName}, ${pdfBuffer.length} bytes) to Gemini model: ${GEMINI_MODEL}`);

    let response;
    let modelUsed = GEMINI_MODEL;
    try {
      response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data,
            },
          },
          {
            text: rorPrompt,
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: rorResponseSchema,
          temperature: 0.1, // Low temperature for factual extraction
        },
      });
    } catch (primaryErr: any) {
      console.warn(`Primary model ${GEMINI_MODEL} failed (${primaryErr.message}). Retrying with fallback model: ${FALLBACK_MODEL}`);
      modelUsed = FALLBACK_MODEL;
      response = await ai.models.generateContent({
        model: FALLBACK_MODEL,
        contents: [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64Data,
            },
          },
          {
            text: rorPrompt,
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: rorResponseSchema,
          temperature: 0.1,
        },
      });
    }

    const responseText = response.text || '';
    console.log(`Gemini extraction raw response length (${modelUsed}):`, responseText.length);

    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON response from Gemini:', responseText);
      res.status(500).json({
        error: 'Failed to parse JSON extraction response from AI model.',
        rawText: responseText,
      });
      return;
    }

    // Ensure document source filename and fallback fields
    if (parsedData.document) {
      parsedData.document.sourceFileName = fileName;
      if (!parsedData.document.village && parsedData.document.mouza) {
        parsedData.document.village = parsedData.document.mouza;
      }
    }

    res.json({
      success: true,
      modelUsed: modelUsed,
      extractedAt: new Date().toISOString(),
      data: parsedData,
      rawJsonString: responseText,
    });
  } catch (error: any) {
    console.error('Error during ROR PDF extraction:', error);
    res.status(500).json({
      error: error.message || 'An unexpected error occurred during ROR PDF extraction.',
      details: String(error),
    });
  }
});

// Endpoint to generate a realistic sample Odisha ROR PDF for testing/demo
app.get('/api/sample-ror-pdf', (_req: Request, res: Response) => {
  // Generate a mock PDF buffer that mimics an official Odisha ROR Patta PDF layout
  // We send a styled HTML content string convertable or simple minimal valid PDF
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Sample_Odisha_ROR_Khata49.pdf"');
  
  // A minimal binary PDF representation of an official Odisha ROR document
  // To ensure standard PDF rendering across browsers, we build a clean valid minimal PDF stream
  const samplePdfContent = Buffer.from(createSampleRORPdf());
  res.send(samplePdfContent);
});

// Vite / Production Static File Middleware
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Offline Khana-2 Correction Reporting System backend listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
