"use client";

import React, { useState, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Rnd } from 'react-rnd';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import SignatureCanvas from 'react-signature-canvas';
import { Download, Upload, Type, CheckSquare, PenTool, X, File as FileIcon, Plus, GripHorizontal, Check, Scissors, Eraser, Image as ImageIcon, Square, Minus, Trash2, AlignLeft, AlignCenter, AlignRight, Edit3 } from 'lucide-react';
import { useAuthPayment } from '@/context/AuthPaymentContext';
import PricingModal from './PricingModal';
import Link from 'next/link';

// Setup PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type FieldType = 'text' | 'checkbox' | 'signature' | 'whiteout' | 'image' | 'box' | 'line' | 'draw';

interface FieldInfo {
  id: string;
  type: FieldType;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string;
  page: number;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  fillColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
  textAlign?: 'left' | 'center' | 'right';
}

const DB_NAME = 'pdfEditorDB';
const STORE_NAME = 'pdfProject';

const openDB = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const saveToDB = async (val: any) => {
  try {
    const db = await openDB();
    db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(val, 'project');
  } catch (e) {
    console.error("Auto-save failed:", e);
  }
};

const loadFromDB = async () => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get('project');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
};

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return rgb(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    );
  }
  return rgb(0, 0, 0);
};


export default function PDFEditor() {
  const { isAuthenticated, hasSubscription, setShowLoginModal, setShowPaymentModal, logout } = useAuthPayment();
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.5);

  const [fields, setFields] = useState<FieldInfo[]>([]);
  const [activeTool, setActiveTool] = useState<FieldType | 'select-move' | null>(null);

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingSignatureField, setPendingSignatureField] = useState<FieldInfo | null>(null);

  // Selection box state
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number, y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number, y: number } | null>(null);
  
  // Drag and drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [downloadName, setDownloadName] = useState('edited_document.pdf');

  // Freehand drawing state
  const [currentDrawPoints, setCurrentDrawPoints] = useState<{x: number, y: number}[]>([]);

  // New PDF state
  const [showNewPdfModal, setShowNewPdfModal] = useState(false);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 595, height: 842, numPages: 1 }); // Default A4 size in points


  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Load PDF Page
  useEffect(() => {
    if (!pdfDataUrl) return;

    const loadPage = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ url: pdfDataUrl });
        const pdf = await loadingTask.promise;
        setNumPages(pdf.numPages);

        const page = await pdf.getPage(currentPage);
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        };

        await page.render(renderContext as any).promise;
      } catch (err) {
        console.error("Error rendering PDF:", err);
      }
    };

    loadPage();
  }, [pdfDataUrl, currentPage, scale]);

  const processPdfFile = (file: File) => {
    setPdfFile(file);
    setDownloadName(`filled_${file.name}`);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPdfDataUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let w = img.width || 150;
        let h = img.height || 150;
        const maxDim = 250;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = (h / w) * maxDim;
            w = maxDim;
          } else {
            w = (w / h) * maxDim;
            h = maxDim;
          }
        }
        setFields(prev => [...prev, {
          id: Date.now().toString(),
          type: 'image',
          x: 100,
          y: 100,
          width: w,
          height: h,
          value: dataUrl,
          page: currentPage,
          opacity: 1,
        }]);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      processPdfFile(file);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      processImageFile(file);
    }
    // reset input
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // Drag and drop event handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf") {
      processPdfFile(file);
    } else if (file.type.startsWith("image/")) {
      processImageFile(file);
    }
  };

  const createBlankPDF = async () => {
    try {
      const pdfDoc = await PDFDocument.create();
      for (let i = 0; i < pdfDimensions.numPages; i++) {
        pdfDoc.addPage([pdfDimensions.width, pdfDimensions.height]);
      }
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const file = new File([blob], "New_Document.pdf", { type: 'application/pdf' });

      setPdfFile(file);
      setDownloadName(`New_Document.pdf`);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPdfDataUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      setShowNewPdfModal(false);
    } catch (err) {
      console.error("Error creating blank PDF:", err);
    }
  };

  const removePDF = () => {
    setPdfFile(null);
    setPdfDataUrl(null);
    setFields([]);
    setCurrentPage(1);
    setNumPages(1);
    setActiveTool(null);
  };

  const addPageToPDF = async () => {
    if (!pdfFile || !pdfDataUrl) return;
    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      const pages = pdfDoc.getPages();
      let width = 595.28;
      let height = 841.89;
      if (pages.length > 0) {
        const size = pages[pages.length - 1].getSize();
        width = size.width;
        height = size.height;
      }

      pdfDoc.addPage([width, height]);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const newFile = new File([blob], pdfFile.name || "Document.pdf", { type: 'application/pdf' });

      setPdfFile(newFile);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPdfDataUrl(e.target?.result as string);
        setCurrentPage(numPages + 1);
        setNumPages(numPages + 1);
      };
      reader.readAsDataURL(newFile);
    } catch (err) {
      console.error("Error adding new page:", err);
    }
  };

  const removePageFromPDF = async () => {
    if (!pdfFile || !pdfDataUrl || numPages <= 1) return;

    if (!confirm('Are you sure you want to delete this page? All content on it will be lost.')) return;

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      pdfDoc.removePage(currentPage - 1);

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const newFile = new File([blob], pdfFile.name || "Document.pdf", { type: 'application/pdf' });

      setPdfFile(newFile);

      // Update fields
      const newFields = fields
        .filter(f => f.page !== currentPage) // remove fields on this page
        .map(f => {
          if (f.page > currentPage) {
            return { ...f, page: f.page - 1 };
          }
          return f;
        });
      setFields(newFields);

      const newNumPages = numPages - 1;
      setNumPages(newNumPages);
      if (currentPage > newNumPages) {
        setCurrentPage(newNumPages);
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setPdfDataUrl(e.target?.result as string);
      };
      reader.readAsDataURL(newFile);
    } catch (err) {
      console.error("Error removing page:", err);
    }
  };

  const saveProject = async () => {
    if (!pdfDataUrl) return;
    await saveToDB({ pdfDataUrl, fields, numPages, pdfFile });
    alert('Project saved successfully! (Note: Auto-save is also active)');
  };

  const loadProject = async () => {
    const project: any = await loadFromDB();
    if (project && project.pdfDataUrl) {
      setPdfDataUrl(project.pdfDataUrl);
      setFields(project.fields || []);
      setNumPages(project.numPages || 1);
      if (project.pdfFile) setPdfFile(project.pdfFile);
    } else {
      alert('No saved project found!');
    }
  };

  // Auto-save on changes
  useEffect(() => {
    if (pdfDataUrl) {
      const timeout = setTimeout(() => {
        saveToDB({ pdfDataUrl, fields, numPages, pdfFile });
      }, 1000); // 1s debounce
      return () => clearTimeout(timeout);
    }
  }, [pdfDataUrl, fields, numPages, pdfFile]);

  // Auto-load on mount
  useEffect(() => {
    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPointerCoords = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pdfContainerRef.current) return { x: 0, y: 0 };
    const rect = pdfContainerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeTool) return;
    const coords = getPointerCoords(e);

    if (activeTool === 'whiteout' || activeTool === 'select-move' || activeTool === 'draw') {
      setIsDrawing(true);
      if (activeTool === 'draw') {
        setCurrentDrawPoints([coords]);
      } else {
        setDrawStart(coords);
        setDrawCurrent(coords);
      }
      // Capture pointer so if user moves mouse outside div it still draws
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Normal point-and-click tools
    const newField: FieldInfo = {
      id: Date.now().toString(),
      type: activeTool as FieldType,
      x: coords.x,
      y: coords.y,
      width: activeTool === 'checkbox' ? 20 : (activeTool === 'box' ? 100 : (activeTool === 'line' ? 200 : 150)),
      height: activeTool === 'checkbox' ? 20 : (activeTool === 'box' ? 100 : (activeTool === 'line' ? 20 : 30)),
      value: activeTool === 'checkbox' ? 'true' : '',
      page: currentPage,
      fontSize: 14,
      fontWeight: 'normal',
      color: '#000000',
      fillColor: 'transparent',
      borderColor: '#000000',
      borderWidth: 2,
      borderRadius: 0
    };

    if (activeTool === 'signature') {
      setPendingSignatureField(newField);
      setShowSignatureModal(true);
      setActiveTool(null);
      return;
    }

    setFields([...fields, newField]);
    setActiveTool(null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing) return;
    const coords = getPointerCoords(e);
    if (activeTool === 'draw') {
      setCurrentDrawPoints(prev => [...prev, coords]);
    } else {
      setDrawCurrent(coords);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    if (activeTool === 'draw') {
      if (currentDrawPoints.length > 1) {
        const xs = currentDrawPoints.map(p => p.x);
        const ys = currentDrawPoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        const normalizedPoints = currentDrawPoints.map(p => ({
          x: p.x - minX,
          y: p.y - minY
        }));

        const newField: FieldInfo = {
          id: Date.now().toString(),
          type: 'draw',
          x: minX,
          y: minY,
          width: Math.max(maxX - minX, 10),
          height: Math.max(maxY - minY, 10),
          value: JSON.stringify(normalizedPoints),
          page: currentPage,
          borderColor: '#000000',
          borderWidth: 2
        };
        setFields(prev => [...prev, newField]);
      }
      setCurrentDrawPoints([]);
      setActiveTool(null);
      return;
    }

    if (!drawStart || !drawCurrent) return;

    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const width = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);

    if (width > 5 && height > 5) {
      if (activeTool === 'whiteout') {
        setFields(prev => [...prev, {
          id: Date.now().toString(),
          type: 'whiteout',
          x, y, width, height, value: '', page: currentPage
        }]);
      } else if (activeTool === 'select-move') {
        // Capture image from canvas
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            const imageData = ctx.getImageData(x, y, width, height);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCtx.putImageData(imageData, 0, 0);
              const dataUrl = tempCanvas.toDataURL('image/png');

              // 1. Add whiteout to hide original
              const whiteoutId = Date.now().toString() + '_hide';
              const imgId = Date.now().toString() + '_img';

              setFields(prev => [
                ...prev,
                { id: whiteoutId, type: 'whiteout', x, y, width, height, value: '', page: currentPage },
                { id: imgId, type: 'image', x, y, width, height, value: dataUrl, page: currentPage }
              ]);
            }
          }
        }
      }
    }
    setDrawStart(null);
    setDrawCurrent(null);
    setActiveTool(null);
  };

  const updateField = (id: string, updates: Partial<FieldInfo>) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const handleSignatureSave = () => {
    if (sigCanvasRef.current && pendingSignatureField && !sigCanvasRef.current.isEmpty()) {
      const dataURL = sigCanvasRef.current.getTrimmedCanvas().toDataURL('image/png');
      const newField = {
        ...pendingSignatureField,
        value: dataURL,
        width: 150,
        height: 60
      };
      setFields([...fields, newField]);
      setShowSignatureModal(false);
      setPendingSignatureField(null);
    }
  };

  const downloadFinalPDF = async () => {
    if (!pdfFile) return;

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // We will loop through the fields and embed them. Whiteouts must go first!
      const sortedFields = [...fields].sort((a, b) => {
        if (a.type === 'whiteout' && b.type !== 'whiteout') return -1;
        if (a.type !== 'whiteout' && b.type === 'whiteout') return 1;
        return 0;
      });

      for (const field of sortedFields) {
        const page = pdfDoc.getPage(field.page - 1);
        const { height } = page.getSize();

        // Calculate coordinates (PDF coordinate system is from bottom left)
        const pdfX = (field.x / scale);
        const pdfY = height - ((field.y + field.height) / scale);

        if (field.type === 'text') {
          const font = field.fontWeight === 'bold' ? helveticaBoldFont : helveticaFont;
          const fontSize = (field.fontSize || 14) / scale;
          const lines = field.value.split('\n');
          const lineHeight = ((field.fontSize || 14) + 6) / scale;
          const textColor = hexToRgb(field.color || '#000000');
          const textPdfWidth = field.width / scale;
          const textPdfY = pdfY + field.height / scale - fontSize - (4 / scale); // start from top of bounding box

          lines.forEach((line, index) => {
            const lineWidth = font.widthOfTextAtSize(line, fontSize);
            let lineX = pdfX + (4 / scale);
            if (field.textAlign === 'center') {
              lineX = pdfX + (textPdfWidth / 2) - (lineWidth / 2);
            } else if (field.textAlign === 'right') {
              lineX = pdfX + textPdfWidth - lineWidth - (4 / scale);
            }

            page.drawText(line, {
              x: lineX,
              y: textPdfY - (index * lineHeight),
              size: fontSize,
              color: textColor,
              font: font,
            });
          });
        } else if (field.type === 'draw') {
          const points = JSON.parse(field.value) as {x: number, y: number}[];
          const thickness = (field.borderWidth !== undefined ? field.borderWidth : 2) / scale;
          const strokeColor = hexToRgb(field.borderColor || '#000000');
          const fillColor = field.fillColor && field.fillColor !== 'transparent' ? hexToRgb(field.fillColor) : undefined;
          
          if (points.length > 0) {
            const pathStr = "M " + points.map(p => `${p.x / scale} ${-p.y / scale}`).join(" L ");
            page.drawSvgPath(pathStr, {
              x: pdfX,
              y: pdfY + field.height / scale,
              borderColor: strokeColor,
              borderWidth: thickness,
              color: fillColor,
            });
          }
        } else if (field.type === 'box') {
          const borderWidth = (field.borderWidth !== undefined ? field.borderWidth : 2) / scale;
          const r = (field.borderRadius || 0) / scale;
          const w = field.width / scale;
          const h = field.height / scale;
          const fillColorObj = field.fillColor && field.fillColor !== 'transparent' ? hexToRgb(field.fillColor) : undefined;
          const borderColorObj = field.borderColor && field.borderColor !== 'transparent' ? hexToRgb(field.borderColor) : undefined;

          if (r > 0) {
            const path = `M ${r} 0 L ${w - r} 0 Q ${w} 0, ${w} ${r} L ${w} ${h - r} Q ${w} ${h}, ${w - r} ${h} L ${r} ${h} Q 0 ${h}, 0 ${h - r} L 0 ${r} Q 0 0, ${r} 0 Z`;
            page.drawSvgPath(path, {
              x: pdfX,
              y: pdfY + h,
              color: fillColorObj,
              borderColor: borderColorObj,
              borderWidth: borderWidth,
            });
          } else {
            page.drawRectangle({
              x: pdfX,
              y: pdfY,
              width: w,
              height: h,
              color: fillColorObj,
              borderColor: borderColorObj,
              borderWidth: borderWidth,
            });
          }
        } else if (field.type === 'line') {
          const thickness = (field.borderWidth !== undefined ? field.borderWidth : 2) / scale;
          page.drawLine({
            start: { x: pdfX, y: pdfY + ((field.height / 2) / scale) },
            end: { x: pdfX + (field.width / scale), y: pdfY + ((field.height / 2) / scale) },
            thickness: thickness,
            color: field.borderColor && field.borderColor !== 'transparent' ? hexToRgb(field.borderColor) : rgb(0, 0, 0),
          });
        } else if (field.type === 'checkbox') {
          if (field.value === 'true') {
            const thickness = 2 / scale;
            page.drawLine({
              start: { x: pdfX + (4 / scale), y: pdfY + (10 / scale) },
              end: { x: pdfX + (8 / scale), y: pdfY + (4 / scale) },
              thickness,
              color: rgb(0, 0, 0),
            });
            page.drawLine({
              start: { x: pdfX + (8 / scale), y: pdfY + (4 / scale) },
              end: { x: pdfX + (16 / scale), y: pdfY + (16 / scale) },
              thickness,
              color: rgb(0, 0, 0),
            });
          }
        } else if (field.type === 'whiteout') {
          // Expand the whiteout slightly by 1pt to avoid leaving border artifacts (nishan)
          page.drawRectangle({
            x: pdfX - 1,
            y: pdfY - 1,
            width: (field.width / scale) + 2,
            height: (field.height / scale) + 2,
            color: rgb(1, 1, 1),
          });
        } else if ((field.type === 'signature' || field.type === 'image') && field.value) {
          let imageBytes: ArrayBuffer;
          let isJpeg = field.value.includes('image/jpeg') || field.value.includes('image/jpg');
          
          if (field.value.startsWith('data:')) {
            const base64Data = field.value.split(',')[1];
            const binaryString = window.atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            imageBytes = bytes.buffer;
          } else {
            imageBytes = await fetch(field.value).then(res => res.arrayBuffer());
          }

          let image;
          try {
            if (isJpeg) {
              image = await pdfDoc.embedJpg(imageBytes);
            } else {
              image = await pdfDoc.embedPng(imageBytes);
            }
          } catch (e) {
            console.warn("Primary embed failed, trying fallback...", e);
            try {
              image = isJpeg ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);
            } catch (fallbackErr) {
              // Ultimate fallback: draw to canvas and export as clean PNG
              console.warn("Fallback embed failed, converting via canvas...", fallbackErr);
              const img = new Image();
              img.src = field.value;
              await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
              
              const canvas = document.createElement('canvas');
              // Calculate a high-resolution size based on the field dimensions to avoid blurriness
              // Multiply by 3 for retina/high-DPI quality in the PDF
              const highResScale = 3; 
              const drawWidth = (field.width / scale) * highResScale;
              const drawHeight = (field.height / scale) * highResScale;
              
              canvas.width = drawWidth || 300;
              canvas.height = drawHeight || 300;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                // For SVGs or other formats, we draw them exactly to the high-res canvas dimensions
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              }
              
              const cleanDataUrl = canvas.toDataURL('image/png');
              const cleanBase64 = cleanDataUrl.split(',')[1];
              const cleanBinaryString = window.atob(cleanBase64);
              const cleanBytes = new Uint8Array(cleanBinaryString.length);
              for (let i = 0; i < cleanBinaryString.length; i++) {
                cleanBytes[i] = cleanBinaryString.charCodeAt(i);
              }
              image = await pdfDoc.embedPng(cleanBytes.buffer);
            }
          }

          page.drawImage(image, {
            x: pdfX,
            y: pdfY,
            width: field.width / scale,
            height: field.height / scale,
            opacity: field.opacity !== undefined ? field.opacity : 1,
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName.endsWith('.pdf') ? downloadName : `${downloadName}.pdf`;
      link.click();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error generating final PDF:", err);
    }
  };

  // Calculate drawing box style
  let drawBoxStyle = {};
  if (isDrawing && drawStart && drawCurrent) {
    const x = Math.min(drawStart.x, drawCurrent.x);
    const y = Math.min(drawStart.y, drawCurrent.y);
    const width = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);
    drawBoxStyle = {
      left: x, top: y, width, height,
      position: 'absolute',
      border: activeTool === 'whiteout' ? '2px dashed #ef4444' : '2px dashed #3b82f6',
      backgroundColor: activeTool === 'whiteout' ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
      pointerEvents: 'none',
      zIndex: 50
    };
  }

  return (
    <div 
      className="flex h-screen bg-neutral-50 text-neutral-900 font-sans overflow-hidden selection:bg-blue-500/30"
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave} 
      onDrop={handleDrop}
    >
      {/* Global Drag Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 bg-blue-500/10 backdrop-blur-sm z-[9999] border-[6px] border-dashed border-blue-500/50 flex flex-col items-center justify-center animate-in fade-in duration-200 pointer-events-none">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center">
            <div className="p-4 bg-blue-50 rounded-full mb-4">
              <Upload className="w-10 h-10 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 mb-1">Drop file to upload</h2>
            <p className="text-neutral-500 text-sm">You can drop a PDF or an Image here</p>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-72 bg-white/90 backdrop-blur-xl border-r border-neutral-200 flex flex-col shadow-2xl z-10 shrink-0">
        <div className="p-6 border-b border-neutral-200 flex items-center justify-between bg-white/60">
          <h1 className="text-xl font-bold text-neutral-900 flex items-center gap-2 tracking-tight">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <FileIcon className="w-5 h-5" />
            </div>
            PDF Editor
          </h1>
          <div className="flex gap-2">
            {isAuthenticated ? (
              <Link href="/profile" className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 bg-neutral-100 hover:bg-neutral-200 hover:text-neutral-900 px-2.5 py-1.5 rounded-md transition-all flex items-center">
                Profile
              </Link>
            ) : (
              <Link href="/login" className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 bg-neutral-100 hover:bg-neutral-200 hover:text-neutral-900 px-2.5 py-1.5 rounded-md transition-all flex items-center">
                Login
              </Link>
            )}
            <button onClick={() => setShowPaymentModal(true)} className="text-[10px] font-bold uppercase tracking-wider text-neutral-900 bg-blue-600 hover:bg-blue-500 px-2.5 py-1.5 rounded-md transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)]">
              Pricing
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-8 overflow-y-auto">
          {/* Upload Section */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Document</h2>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-neutral-200 border-dashed rounded-2xl cursor-pointer bg-neutral-50 hover:bg-neutral-50 hover:border-blue-500/50 transition-all group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <div className="p-3 bg-neutral-100 group-hover:bg-blue-500/20 rounded-full mb-3 transition-colors">
                  <Upload className="w-6 h-6 text-neutral-500 group-hover:text-blue-400 transition-colors" />
                </div>
                <p className="mb-1 text-sm text-neutral-700"><span className="font-semibold text-neutral-900">Click to upload</span></p>
                <p className="text-xs text-neutral-400">PDF up to 10MB</p>
              </div>
              <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
            </label>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-neutral-200"></div>
              <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-neutral-400 uppercase tracking-widest">OR</span>
              <div className="flex-grow border-t border-neutral-200"></div>
            </div>

            <button
              onClick={() => setShowNewPdfModal(true)}
              className="w-full flex items-center justify-center gap-2 bg-neutral-50 border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-100 text-neutral-700 hover:text-neutral-900 font-medium py-3 px-4 rounded-2xl transition-all shadow-sm"
            >
              <Plus className="w-5 h-5" /> Create Blank PDF
            </button>
          </div>

          {/* Tools Section */}
          <div className={`space-y-4 ${!pdfDataUrl ? 'opacity-40 pointer-events-none grayscale' : ''} transition-all duration-500`}>
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Insert Tools</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setActiveTool('text')}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200 ${activeTool === 'text' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.15)]' : 'bg-white/60 border-neutral-200 hover:bg-neutral-100 hover:border-neutral-200 text-neutral-500'}`}
              >
                <Type className="w-5 h-5" /> <span className="text-[11px] font-semibold tracking-wide">Text</span>
              </button>
              <button
                onClick={() => setActiveTool('checkbox')}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200 ${activeTool === 'checkbox' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.15)]' : 'bg-white/60 border-neutral-200 hover:bg-neutral-100 hover:border-neutral-200 text-neutral-500'}`}
              >
                <CheckSquare className="w-5 h-5" /> <span className="text-[11px] font-semibold tracking-wide">Checkbox</span>
              </button>
              <button
                onClick={() => setActiveTool('signature')}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200 ${activeTool === 'signature' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.15)]' : 'bg-white/60 border-neutral-200 hover:bg-neutral-100 hover:border-neutral-200 text-neutral-500'}`}
              >
                <PenTool className="w-5 h-5" /> <span className="text-[11px] font-semibold tracking-wide">Signature</span>
              </button>
              <button
                onClick={() => imageInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border bg-white/60 border-neutral-200 hover:bg-neutral-100 hover:border-neutral-200 text-neutral-500 transition-all duration-200"
              >
                <ImageIcon className="w-5 h-5" /> <span className="text-[11px] font-semibold tracking-wide">Image</span>
              </button>
              <button
                onClick={() => setActiveTool('box')}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200 ${activeTool === 'box' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.15)]' : 'bg-white/60 border-neutral-200 hover:bg-neutral-100 hover:border-neutral-200 text-neutral-500'}`}
              >
                <Square className="w-5 h-5" /> <span className="text-[11px] font-semibold tracking-wide">Box</span>
              </button>
              <button
                onClick={() => setActiveTool('line')}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200 ${activeTool === 'line' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.15)]' : 'bg-white/60 border-neutral-200 hover:bg-neutral-100 hover:border-neutral-200 text-neutral-500'}`}
              >
                <Minus className="w-5 h-5" /> <span className="text-[11px] font-semibold tracking-wide">Line</span>
              </button>
              <button
                onClick={() => setActiveTool('draw')}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200 ${activeTool === 'draw' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.15)]' : 'bg-white/60 border-neutral-200 hover:bg-neutral-100 hover:border-neutral-200 text-neutral-500'}`}
              >
                <Edit3 className="w-5 h-5" /> <span className="text-[11px] font-semibold tracking-wide">Draw</span>
              </button>
            </div>
            <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />

            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-8 pt-6 border-t border-neutral-200">Modify Document</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                title="Erase anything on the PDF"
                onClick={() => setActiveTool('whiteout')}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200 ${activeTool === 'whiteout' ? 'bg-red-500/10 border-red-500/50 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.15)]' : 'bg-white/60 border-neutral-200 hover:bg-neutral-100 hover:border-neutral-200 text-neutral-500'}`}
              >
                <Eraser className="w-5 h-5" /> <span className="text-[11px] font-semibold tracking-wide text-center">Eraser</span>
              </button>
              <button
                title="Select and move existing PDF content"
                onClick={() => setActiveTool('select-move')}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200 ${activeTool === 'select-move' ? 'bg-purple-500/10 border-purple-500/50 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.15)]' : 'bg-white/60 border-neutral-200 hover:bg-neutral-100 hover:border-neutral-200 text-neutral-500'}`}
              >
                <Scissors className="w-5 h-5" /> <span className="text-[11px] font-semibold tracking-wide text-center">Cut & Move</span>
              </button>
            </div>

            {activeTool && (
              <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center animate-in fade-in zoom-in duration-300">
                <p className="text-[11px] text-blue-300 font-medium">
                  {activeTool === 'select-move' || activeTool === 'whiteout'
                    ? "Drag on PDF to use tool"
                    : "Click on PDF to place"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Section */}
        <div className="p-6 border-t border-neutral-200 bg-white/90 backdrop-blur-md space-y-3">
          <div className="flex gap-2">
            <button
              onClick={saveProject}
              className="flex-1 flex items-center justify-center gap-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-medium py-2.5 rounded-xl transition-all shadow-sm text-xs"
            >
              Save Draft
            </button>
            <button
              onClick={loadProject}
              className="flex-1 flex items-center justify-center gap-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 font-medium py-2.5 rounded-xl transition-all shadow-sm text-xs"
            >
              Load Draft
            </button>
          </div>
          
          <div className="flex flex-col gap-1.5 pt-2">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">File Name</label>
            <input 
              type="text" 
              value={downloadName} 
              onChange={(e) => setDownloadName(e.target.value)} 
              className="text-sm px-3 py-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-full transition-all bg-neutral-50/50"
              placeholder="document_name.pdf"
            />
          </div>

          <button
            disabled={!pdfDataUrl || !downloadName.trim()}
            onClick={downloadFinalPDF}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-neutral-900 font-bold py-3.5 px-4 rounded-xl transition-all disabled:opacity-50 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
          >
            <Download className="w-5 h-5" /> Download Final PDF
          </button>
        </div>
      </div>

      {/* Main Content - PDF Preview */}
      <div className="flex-1 overflow-auto bg-neutral-50 p-8 relative flex flex-col custom-scrollbar">
        {/* Decorative background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

        {!pdfDataUrl ? (
          <div className="h-full flex flex-col items-center justify-center relative z-10">
            <div className="text-center space-y-6 max-w-md animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/5 shadow-2xl mb-2 relative group">
                <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full group-hover:bg-blue-500/30 transition-all"></div>
                <FileIcon className="w-10 h-10 text-blue-400 relative z-10" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-neutral-900 mb-3 tracking-tight">Ready to Edit?</h2>
                <p className="text-neutral-500 text-sm leading-relaxed">Upload a PDF document from the sidebar or create a new blank canvas to start adding signatures, text, and annotations.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center relative z-10">
            {/* Pagination Controls */}
            <div className="mb-6 flex flex-wrap items-center justify-center gap-4 sticky top-0 z-40 bg-neutral-50/80 backdrop-blur-md p-3 rounded-2xl border border-neutral-200 shadow-2lg">
              <div className="flex items-center gap-4 bg-white px-5 py-2 rounded-xl border border-neutral-200">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                  className="text-neutral-500 hover:text-neutral-900 disabled:opacity-30 transition-colors text-sm font-medium"
                >
                  Previous
                </button>
                <span className="text-sm font-semibold text-neutral-900 bg-neutral-100 px-3 py-1 rounded-md">
                  {currentPage} <span className="text-neutral-400 mx-1">/</span> {numPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.max(numPages, currentPage + 1))}
                  disabled={currentPage >= numPages}
                  className="text-neutral-500 hover:text-neutral-900 disabled:opacity-30 transition-colors text-sm font-medium"
                >
                  Next
                </button>
              </div>
              <div className="h-6 w-px bg-neutral-100"></div>
              <button
                onClick={addPageToPDF}
                className="flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                title="Add a new blank page to this PDF"
              >
                <Plus className="w-4 h-4" /> Add Page
              </button>
              <div className="h-6 w-px bg-neutral-100"></div>
              <button
                onClick={removePDF}
                className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                title="Close this document and start over"
              >
                <X className="w-4 h-4" /> Close Document
              </button>
              {numPages > 1 && (
                <button
                  onClick={removePageFromPDF}
                  className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                  title="Remove current page"
                >
                  <Trash2 className="w-4 h-4" /> Remove Page
                </button>
              )}
            </div>

            {/* PDF Canvas Container */}
            <div
              ref={pdfContainerRef}
              className={`relative border border-neutral-200 rounded-lg overflow-hidden transition-all bg-white ${(activeTool === 'select-move' || activeTool === 'whiteout') ? 'cursor-crosshair touch-none' :
                  activeTool ? 'cursor-crosshair' : ''
                }`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <canvas ref={canvasRef} className="block" />

              {/* Drawing Box */}
              {isDrawing && activeTool !== 'draw' && <div style={drawBoxStyle} />}
              
              {/* Active Freehand Drawing */}
              {isDrawing && activeTool === 'draw' && currentDrawPoints.length > 0 && (
                <svg className="absolute inset-0 pointer-events-none z-50" style={{ width: '100%', height: '100%' }}>
                  <polyline
                    points={currentDrawPoints.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#000000"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}

              {/* Overlays - Render Whiteouts first so they are in the background */}
              {[...fields].sort((a, b) => {
                if (a.type === 'whiteout' && b.type !== 'whiteout') return -1;
                if (a.type !== 'whiteout' && b.type === 'whiteout') return 1;
                return 0;
              }).filter(f => f.page === currentPage).map(field => (
                <Rnd
                  key={field.id}
                  position={{ x: field.x, y: field.y }}
                  size={{ width: field.width, height: field.height }}
                  onDragStop={(e, d) => {
                    updateField(field.id, { x: d.x, y: d.y });
                  }}
                  onResizeStop={(e, direction, ref, delta, position) => {
                    updateField(field.id, {
                      width: parseInt(ref.style.width),
                      height: parseInt(ref.style.height),
                      ...position
                    });
                  }}
                  dragHandleClassName={field.type !== 'whiteout' ? "drag-handle" : ""}
                  disableDragging={field.type === 'whiteout'}
                  enableResizing={field.type !== 'whiteout' ? (field.type === 'line' ? { right: true, left: true, top: false, bottom: false, topLeft: false, topRight: false, bottomLeft: false, bottomRight: false } : true) : false}
                  lockAspectRatio={field.type === 'image' || field.type === 'signature'}
                  bounds="parent"
                  className={`group absolute border ${field.type === 'whiteout' ? 'border-dashed border-transparent hover:border-neutral-300' : 'border-transparent hover:border-neutral-400 hover:bg-neutral-100/50'} ${field.type === 'whiteout' ? 'z-0' : 'z-10'}`}
                >
                  <div className="w-full h-full relative" onPointerDown={(e) => {
                    // Prevent interacting with elements from triggering a new drawing/click on the PDF
                    if (activeTool !== 'whiteout' && activeTool !== 'select-move' && activeTool !== 'draw') {
                      e.stopPropagation();
                    }
                  }}>
                    {field.type !== 'whiteout' && (
                      <div className="drag-handle absolute -top-6 left-1/2 -translate-x-1/2 bg-neutral-900 text-neutral-900 rounded-t px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-grab active:cursor-grabbing shadow-sm flex items-center justify-center">
                        <GripHorizontal className="w-4 h-4" />
                      </div>
                    )}
                    <button
                      onClick={() => removeField(field.id)}
                      className={`absolute ${field.type === 'whiteout' ? '-top-2 -right-2' : '-top-3 -right-3'} bg-red-500 text-neutral-900 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-30 hover:scale-110 shadow-sm`}
                    >
                      <X className="w-3 h-3" />
                    </button>

                    {field.type === 'text' && (
                      <>
                        <div className="absolute -top-10 left-0 bg-white shadow-md border border-neutral-200 flex gap-2 p-1.5 rounded-lg z-50 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          <input type="color" value={field.color || '#000000'} onChange={(e) => updateField(field.id, { color: e.target.value })} className="w-6 h-6 border-0 p-0 cursor-pointer shrink-0" title="Text Color" />
                          <input type="number" value={field.fontSize || 14} onChange={(e) => updateField(field.id, { fontSize: parseInt(e.target.value) || 14 })} className="w-12 border border-neutral-200 rounded text-xs px-1 outline-none focus:border-neutral-900 shrink-0" title="Font Size" />
                          <select value={field.fontWeight || 'normal'} onChange={(e) => updateField(field.id, { fontWeight: e.target.value })} className="text-xs border border-neutral-200 rounded outline-none focus:border-neutral-900 shrink-0">
                            <option value="normal">Normal</option>
                            <option value="bold">Bold</option>
                          </select>
                          <div className="flex border border-neutral-200 rounded overflow-hidden shrink-0">
                            <button onClick={() => updateField(field.id, { textAlign: 'left' })} className={`p-1 hover:bg-neutral-100 ${(!field.textAlign || field.textAlign === 'left') ? 'bg-neutral-200' : ''}`}><AlignLeft className="w-3 h-3 text-neutral-700" /></button>
                            <button onClick={() => updateField(field.id, { textAlign: 'center' })} className={`p-1 border-l border-r border-neutral-200 hover:bg-neutral-100 ${field.textAlign === 'center' ? 'bg-neutral-200' : ''}`}><AlignCenter className="w-3 h-3 text-neutral-700" /></button>
                            <button onClick={() => updateField(field.id, { textAlign: 'right' })} className={`p-1 hover:bg-neutral-100 ${field.textAlign === 'right' ? 'bg-neutral-200' : ''}`}><AlignRight className="w-3 h-3 text-neutral-700" /></button>
                          </div>
                        </div>
                        <textarea
                          value={field.value}
                          onChange={(e) => updateField(field.id, { value: e.target.value })}
                          style={{ 
                            fontSize: `${field.fontSize || 14}px`, 
                            fontWeight: field.fontWeight || 'normal', 
                            color: field.color || '#000000',
                            textAlign: field.textAlign || 'left'
                          }}
                          className="w-full h-full resize-none border border-neutral-300 rounded p-1 bg-white/90 focus:bg-white outline-none focus:ring-2 focus:ring-neutral-900 shadow-sm"
                          placeholder="Type here..."
                        />
                      </>
                    )}

                    {field.type === 'box' && (
                      <>
                        <div className="absolute -top-10 left-0 bg-white shadow-md border border-neutral-200 flex gap-2 p-1.5 rounded-lg z-50 pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity">
                          <input type="color" value={field.fillColor && field.fillColor !== 'transparent' ? field.fillColor : '#ffffff'} onChange={(e) => updateField(field.id, { fillColor: e.target.value })} className="w-6 h-6 border-0 p-0 cursor-pointer" title="Fill Color" />
                          <button onClick={() => updateField(field.id, { fillColor: 'transparent' })} className="text-xs border px-1 rounded hover:bg-neutral-100" title="Transparent Fill">T</button>
                          <input type="color" value={field.borderColor || '#000000'} onChange={(e) => updateField(field.id, { borderColor: e.target.value })} className="w-6 h-6 border-0 p-0 cursor-pointer" title="Border Color" />
                          <input type="number" value={field.borderWidth !== undefined ? field.borderWidth : 2} onChange={(e) => updateField(field.id, { borderWidth: parseInt(e.target.value) || 0 })} className="w-12 border border-neutral-200 rounded text-xs px-1 outline-none focus:border-neutral-900" title="Border Width" />
                          <input type="number" value={field.borderRadius || 0} onChange={(e) => updateField(field.id, { borderRadius: parseInt(e.target.value) || 0 })} className="w-12 border border-neutral-200 rounded text-xs px-1 outline-none focus:border-neutral-900" title="Border Radius" />
                        </div>
                        <div
                          className="w-full h-full"
                          style={{
                            backgroundColor: field.fillColor === 'transparent' ? 'transparent' : (field.fillColor || 'transparent'),
                            border: `${field.borderWidth !== undefined ? field.borderWidth : 2}px solid ${field.borderColor || '#000000'}`,
                            borderRadius: `${field.borderRadius || 0}px`
                          }}
                        />
                      </>
                    )}

                    {field.type === 'line' && (
                      <div className="w-full h-full relative group/line flex items-center justify-center">
                        <div className="absolute -top-10 left-0 bg-white shadow-md border border-neutral-200 flex gap-2 p-1.5 rounded-lg z-50 pointer-events-auto opacity-0 group-hover/line:opacity-100 transition-opacity">
                          <input type="color" value={field.borderColor || '#000000'} onChange={(e) => updateField(field.id, { borderColor: e.target.value })} className="w-6 h-6 border-0 p-0 cursor-pointer" title="Line Color" />
                          <input type="number" value={field.borderWidth !== undefined ? field.borderWidth : 2} onChange={(e) => updateField(field.id, { borderWidth: parseInt(e.target.value) || 0 })} className="w-12 border border-neutral-200 rounded text-xs px-1 outline-none focus:border-neutral-900" title="Line Thickness" />
                        </div>
                        <div
                          className="w-full"
                          style={{
                            height: `${field.borderWidth !== undefined ? field.borderWidth : 2}px`,
                            backgroundColor: field.borderColor || '#000000'
                          }}
                        />
                      </div>
                    )}

                    {field.type === 'checkbox' && (
                      <div
                        className="checkbox-area w-full h-full border-2 border-neutral-400 rounded-sm bg-white flex items-center justify-center cursor-pointer shadow-sm hover:border-neutral-900 transition-colors"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          updateField(field.id, { value: field.value === 'true' ? 'false' : 'true' });
                        }}
                      >
                        {field.value === 'true' && <Check className="w-5 h-5 text-neutral-900 stroke-[3] pointer-events-none" />}
                      </div>
                    )}

                    {field.type === 'draw' && (
                      <div className="w-full h-full relative group/draw">
                        <div className="absolute -top-10 left-0 bg-white shadow-md border border-neutral-200 flex gap-2 p-1.5 rounded-lg z-50 pointer-events-auto opacity-0 group-hover/draw:opacity-100 transition-opacity whitespace-nowrap">
                          <input type="color" value={field.fillColor && field.fillColor !== 'transparent' ? field.fillColor : '#ffffff'} onChange={(e) => updateField(field.id, { fillColor: e.target.value })} className="w-6 h-6 border-0 p-0 cursor-pointer shrink-0" title="Fill Color" />
                          <button onClick={() => updateField(field.id, { fillColor: 'transparent' })} className="text-xs border px-1 rounded hover:bg-neutral-100 shrink-0" title="Transparent Fill">T</button>
                          <input type="color" value={field.borderColor || '#000000'} onChange={(e) => updateField(field.id, { borderColor: e.target.value })} className="w-6 h-6 border-0 p-0 cursor-pointer shrink-0" title="Pen Color" />
                          <input type="number" value={field.borderWidth !== undefined ? field.borderWidth : 2} onChange={(e) => updateField(field.id, { borderWidth: parseInt(e.target.value) || 1 })} className="w-12 border border-neutral-200 rounded text-xs px-1 outline-none focus:border-neutral-900 shrink-0" title="Pen Thickness" />
                        </div>
                        <svg className="w-full h-full" viewBox={`0 0 ${field.width} ${field.height}`} preserveAspectRatio="none">
                          <polyline
                            points={JSON.parse(field.value).map((p: any) => `${p.x},${p.y}`).join(' ')}
                            fill={field.fillColor && field.fillColor !== 'transparent' ? field.fillColor : 'none'}
                            stroke={field.borderColor || '#000000'}
                            strokeWidth={field.borderWidth !== undefined ? field.borderWidth : 2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>
                      </div>
                    )}

                    {(field.type === 'signature' || field.type === 'image') && (
                      <div className={`w-full h-full relative group/image flex items-center justify-center overflow-visible ${field.type === 'signature' ? 'border border-neutral-300 bg-white/50 rounded' : ''}`}>
                        {field.type === 'image' && (
                          <div className="absolute -top-10 left-0 bg-white shadow-md border border-neutral-200 flex gap-2 p-1.5 rounded-lg z-50 pointer-events-auto opacity-0 group-hover/image:opacity-100 transition-opacity">
                            <label className="text-xs text-neutral-500 flex items-center gap-1 font-medium">
                              Opacity
                              <input type="range" min="0" max="1" step="0.1" value={field.opacity !== undefined ? field.opacity : 1} onChange={(e) => updateField(field.id, { opacity: parseFloat(e.target.value) })} className="w-20 cursor-pointer accent-neutral-900" title="Opacity" />
                            </label>
                          </div>
                        )}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={field.value} alt="Content" className="w-full h-full object-fill pointer-events-none" style={{ opacity: field.opacity !== undefined ? field.opacity : 1 }} />
                      </div>
                    )}

                    {field.type === 'whiteout' && (
                      <div className="w-full h-full bg-white opacity-100 pointer-events-none" />
                    )}
                  </div>
                </Rnd>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center animate-in fade-in zoom-in-95 duration-200 p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden relative">
            <div className="p-5 border-b border-neutral-200 flex justify-between items-center bg-white/60">
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                <PenTool className="w-4 h-4 text-blue-400" /> Draw Signature
              </h3>
              <button onClick={() => {
                setShowSignatureModal(false);
                setPendingSignatureField(null);
              }} className="text-neutral-400 hover:text-neutral-900 transition-colors bg-neutral-100 rounded-full p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              <div className="border border-neutral-200 rounded-xl bg-white/95 overflow-hidden cursor-crosshair shadow-inner">
                <SignatureCanvas
                  ref={sigCanvasRef}
                  canvasProps={{ width: 450, height: 200, className: 'sigCanvas' }}
                  backgroundColor="transparent"
                  penColor="black"
                />
              </div>
              <div className="flex justify-between mt-6">
                <button
                  onClick={() => sigCanvasRef.current?.clear()}
                  className="px-4 py-2.5 text-sm font-medium text-neutral-500 bg-neutral-100 hover:bg-neutral-200 hover:text-neutral-900 rounded-xl transition-all"
                >
                  Clear
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowSignatureModal(false);
                      setPendingSignatureField(null);
                    }}
                    className="px-4 py-2.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSignatureSave}
                    className="px-6 py-2.5 text-sm font-medium text-neutral-900 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-500/20"
                  >
                    Save Signature
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New PDF Size Modal */}
      {showNewPdfModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center animate-in fade-in zoom-in-95 duration-200 p-4">
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative">
            <div className="p-5 border-b border-neutral-200 flex justify-between items-center bg-white/60">
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                <FileIcon className="w-4 h-4 text-blue-400" /> New Blank PDF
              </h3>
              <button onClick={() => setShowNewPdfModal(false)} className="text-neutral-400 hover:text-neutral-900 transition-colors bg-neutral-100 rounded-full p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wide">Width (px)</label>
                  <input
                    type="number"
                    value={pdfDimensions.width}
                    onChange={(e) => setPdfDimensions(prev => ({ ...prev, width: Number(e.target.value) }))}
                    className="w-full bg-neutral-100 border border-neutral-200 text-neutral-900 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wide">Height (px)</label>
                  <input
                    type="number"
                    value={pdfDimensions.height}
                    onChange={(e) => setPdfDimensions(prev => ({ ...prev, height: Number(e.target.value) }))}
                    className="w-full bg-neutral-100 border border-neutral-200 text-neutral-900 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wide">Number of Pages</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={pdfDimensions.numPages}
                  onChange={(e) => setPdfDimensions(prev => ({ ...prev, numPages: Number(e.target.value) }))}
                  className="w-full bg-neutral-100 border border-neutral-200 text-neutral-900 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                />
              </div>
              <p className="text-[11px] text-neutral-400 text-center pt-2">
                Standard A4 size is 595 x 842
              </p>

              <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-neutral-200">
                <button
                  onClick={() => setShowNewPdfModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={createBlankPDF}
                  className="px-6 py-2.5 text-sm font-medium text-neutral-900 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-500/20"

                >
                  Create PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <PricingModal />
    </div>
  );
}
