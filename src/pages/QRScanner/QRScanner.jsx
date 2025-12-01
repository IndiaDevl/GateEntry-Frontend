// Version 6 - Create Gate Entry + Material Inward (Weight Document) together
import React, { useState, useEffect, useRef } from "react";
import { createHeader, createMaterialInward, fetchNextGateNumber, fetchNextWeightDocNumber, sendEmailNotification,fetchPurchaseOrderByPermitNumber } from "../../components/Api";
import { useLocation } from "react-router-dom";
import jsQR from "jsqr";

export default function CreateHeader() {
  const currentDate = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear().toString();

  // Helper: Format current time into SAP duration string e.g. PT16H42M16S
  const formatTimeToSapDuration = (date = new Date()) => {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `PT${hh}H${mm}M${ss}S`;
  };

  // Helper: Full ISO timestamp (UTC) for SAP_CreatedDateTime
  const nowIso = (date = new Date()) => date.toISOString();

  // Create initial state function to avoid reference issues
  const createInitialHeaderState = () => {
    const initialState = {
      GateEntryNumber: "",
      GateEntryDate: currentDate,
      VehicleNumber: "",
      TransporterCode: "",
      TransporterName: "",
      DriverName: "",
      DriverPhoneNumber: "",
      LRGCNumber: "",
      PermitNumber: "",
      EWayBill: false,
      Division: "",
      Remarks: "",
      SubTransporterName: "",
      FiscalYear: currentYear,
      InwardTime: new Date().toISOString().includes('T')
        ? `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}:${new Date().getSeconds().toString().padStart(2, '0')}`
        : '',
      OutwardTime: new Date().toISOString().includes('T')
        ? `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}:${new Date().getSeconds().toString().padStart(2, '0')}`
        : '',
      SAP_CreatedDateTime: new Date().toISOString(),
      
      // Weight Bridge fields (NEW)
      WeightDocNumber: "",
      GrossWeight: "",
      TruckCapacity: "",
    };

    // Add PO fields dynamically
    for (let i = 1; i <= 5; i++) {
      const suffix = i === 1 ? "" : String(i);
      initialState[`PurchaseOrderNumber${suffix}`] = "";
      initialState[`Material${suffix}`] = "";
      initialState[`MaterialDescription${suffix}`] = "";
      initialState[`Vendor${suffix}`] = "";
      initialState[`VendorName${suffix}`] = "";
      initialState[`VendorInvoiceNumber${suffix}`] = "";
      initialState[`VendorInvoiceDate${suffix}`] = "";
      initialState[`VendorInvoiceWeight${suffix}`] = "";
      initialState[`BalanceQty${suffix}`] = "";
    }

    return initialState;
  };

  const [header, setHeader] = useState(createInitialHeaderState());
  const [series, setSeries] = useState("2");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  
  // QR Scanner states
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrMode, setQrMode] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [qrError, setQrError] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // New state variables for external scanner
  const [scannerBuffer, setScannerBuffer] = useState('');
  const [scannerTimeout, setScannerTimeout] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.includes('VendorInvoiceWeight') || name.includes('BalanceQty') || name === 'GrossWeight' || name === 'TruckCapacity') {
      if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
        setHeader(prev => ({ ...prev, [name]: value }));
      }
    } else {
      setHeader(prev => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value
      }));
    }
  };



  // Only update FiscalYear and fetch PO by PermitNumber on change
  useEffect(() => {
    if (header.GateEntryDate) {
      const year = header.GateEntryDate.slice(0, 4);
      setHeader(prev => ({ ...prev, FiscalYear: year }));
    }

    // If PermitNumber is present, fetch PO details and fill PO fields
    const tryFetchPOByPermit = async () => {
      if (header.PermitNumber && header.PermitNumber.length > 0) {
        try {
          const resp = await fetchPurchaseOrderByPermitNumber(header.PermitNumber);
          if (resp.data && resp.data.PurchaseOrder) {
            setHeader(prev => ({
              ...prev,
              PurchaseOrderNumber: resp.data.PurchaseOrder,
              BalanceQty: resp.data.items?.[0]?.OrderQuantity || ''
            }));
          }
        } catch (err) {
          console.warn('No PO found for permit number', header.PermitNumber, err);
        }
      }
    };
    tryFetchPOByPermit();
  }, [header.GateEntryDate, series, currentYear, header.PermitNumber]);

  // QR Code Scanning Functions (same as before)
  const startCameraScanning = async () => {
    setQrError(null);
    setScanning(true);

    const start = async (constraints) => {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();

        scanIntervalRef.current = true;
        const loop = () => {
          if (!scanIntervalRef.current) return;
          captureAndScanFrame();
          requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      }
    };

    try {
      await start({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch (e1) {
      try {
        await start({ video: true, audio: false });
      } catch (e2) {
        console.error('Camera access error:', e2);
        setQrError('Failed to access camera. Please grant camera permissions or try another device.');
        setScanning(false);
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (scanIntervalRef.current) {
      scanIntervalRef.current = null;
    }
  };

  const captureAndScanFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const maxDim = 800;
    const scale = Math.min(1, maxDim / Math.max(vw, vh));
    const w = Math.max(1, Math.floor(vw * scale));
    const h = Math.max(1, Math.floor(vh * scale));

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });

    if (code?.data) {
      stopCamera();
      handleQRScanSuccess(code.data);
    }
  };

  const tryDecodeWithRotations = (img, rotations = [0, 90, 180, 270]) => {
    const off = document.createElement('canvas');
    const ctx = off.getContext('2d', { willReadFrequently: true });
    const maxDim = 1500;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));

    for (const angle of rotations) {
      const rad = (angle * Math.PI) / 180;
      const sW = Math.floor(img.width * scale);
      const sH = Math.floor(img.height * scale);

      if (angle % 180 === 0) {
        off.width = sW;
        off.height = sH;
      } else {
        off.width = sH;
        off.height = sW;
      }

      ctx.save();
      ctx.translate(off.width / 2, off.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -sW / 2, -sH / 2, sW, sH);
      ctx.restore();

      const imageData = ctx.getImageData(0, 0, off.width, off.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
      if (code?.data) return code.data;
    }
    return null;
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setQrError(null);
    setScanning(true);

    try {
      const img = await loadImageFromFile(file);
      const decoded = tryDecodeWithRotations(img);
      if (decoded) {
        handleQRScanSuccess(decoded);
      } else {
        setQrError('No QR code found in the image. Try a clearer, well-lit image.');
        setScanning(false);
      }
    } catch (err) {
      console.error('Image processing error:', err);
      setQrError('Failed to process image: ' + err.message);
      setScanning(false);
    }
  };

  const loadImageFromFile = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // Parse QR Data and populate form (including weight)
  const handleQRScanSuccess = (qrText) => {
    try {
      console.log('✅ QR Code scanned:', qrText);
      const parsedData = parseQRData(qrText);
      
      console.log('📦 Parsed Data:', parsedData); // Debug log
      
      // Update form with parsed data - handle both old and new formats
      setHeader(prev => ({
        ...prev,
        VehicleNumber: parsedData.VehicleNumber || prev.VehicleNumber,
        GateEntryDate: parsedData.GateEntryDate || prev.GateEntryDate,
        InwardTime: parsedData.InwardTime || prev.InwardTime,
        LRGCNumber: parsedData.ReferenceNumber || prev.LRGCNumber,
        PermitNumber: parsedData.PermitNumber || prev.PermitNumber,
        Remarks: parsedData.Remarks || prev.Remarks,
        // Material fields - support both MaterialType (old) and Material (new)
        Material: parsedData.Material || parsedData.MaterialType || prev.Material,
        MaterialDescription: parsedData.MaterialDescription || prev.MaterialDescription,
        // Weight fields
        VendorInvoiceWeight: parsedData.VendorInvoiceWeight || prev.VendorInvoiceWeight,
        GrossWeight: parsedData.GrossWeight || parsedData.VendorInvoiceWeight || prev.GrossWeight,
        // Vendor Invoice Number (NEW - was missing!)
        VendorInvoiceNumber: parsedData.VendorInvoiceNumber || prev.VendorInvoiceNumber,
        // Vendor Invoice Date (try to map to VendorInvoiceDate1 if available)
        VendorInvoiceDate1: parsedData.VendorInvoiceDate || prev.VendorInvoiceDate1,
        // Location (if present)
        Division: parsedData.Location || prev.Division,
      }));

      // Close scanner modal if it's open
      if (showQRScanner) {
        setShowQRScanner(false);
        setQrMode(null);
      }
      
      setScanning(false);
      setQrError(null);
      
      // Show success message with details
      setResult(`✅ QR Code scanned successfully! ${parsedData.Material || parsedData.MaterialType || 'Material'} - ${parsedData.VehicleNumber || 'Vehicle'} loaded.`);
      
      // Auto-clear success message after 5 seconds
      setTimeout(() => setResult(null), 5000);
      
    } catch (err) {
      console.error('QR parse error:', err);
      const errorMsg = 'Failed to parse QR code data: ' + err.message;
      
      // Show error differently based on whether modal is open
      if (showQRScanner) {
        setQrError(errorMsg);
      } else {
        setError(errorMsg);
        setTimeout(() => setError(null), 5000);
      }
      
      setScanning(false);
    }
  };

  const parseQRData = (qrText) => {
    const parts = qrText.split('|').map(p => p.trim());

    if (parts.length < 5) {
      throw new Error('Invalid QR code format. Expected pipe-delimited data.');
    }

    // Detect format by checking if parts[3] contains a date pattern (dd/mm/yyyy) or is just text
    const isOldFormat = parts[3] && /\d{1,2}\/\d{1,2}\/\d{4}/.test(parts[3]);

    if (isOldFormat) {
      // OLD FORMAT: WeightDocNumber | DocumentNumber | Weight | DateTime | VehicleNumber | VehicleType | MaterialType | MaterialDescription | ReferenceNumber | Location
      const parseDateTime = (dateTimeStr) => {
        try {
          const [datePart, timePart, meridiem] = dateTimeStr.split(' ');
          const [day, month, year] = datePart.split('/');
          const [hour, minute] = timePart.split(':');
          let hourNum = parseInt(hour);
          if (meridiem === 'PM' && hourNum !== 12) hourNum += 12;
          if (meridiem === 'AM' && hourNum === 12) hourNum = 0;

          return {
            date: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
            time: `${String(hourNum).padStart(2, '0')}:${minute}:00`
          };
        } catch {
          const now = new Date();
          return {
            date: now.toISOString().split('T')[0],
            time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`
          };
        }
      };

      const dateTime = parts[3] ? parseDateTime(parts[3]) : { date: '', time: '' };

      let remarksText = '';
      if (parts[6]) remarksText += parts[6];
      if (parts[7]) remarksText += (remarksText ? ' - ' : '') + parts[7];
      if (parts[9]) remarksText += (remarksText ? ' | Location: ' : 'Location: ') + parts[9];
      if (parts[2]) remarksText += (remarksText ? ' | Weight: ' : 'Weight: ') + parts[2];

      return {
        PermitNumber: parts[0] || '',
        DocumentNumber: parts[1] || '',
        VehicleNumber: (parts[4] || '').replace(/\s+/g, ''),
        VehicleType: parts[5] || '',
        MaterialType: parts[6] || '',
        MaterialDescription: parts[7] || '',
        VendorInvoiceWeight: parts[2] || '',
        ReferenceNumber: parts[8] || '',
        Location: parts[9] || '',
        GateEntryDate: dateTime.date,
        InwardTime: dateTime.time,
        Remarks: remarksText
      };
    } else {
      // NEW FORMAT: WeightDocNumber | GateEntryNumber | Weight | Material | MaterialDescription | VendorInvoiceNumber | Location1 | DuplicateInvoice | Location2
      
      let remarksText = '';
      if (parts[6]) remarksText += parts[6]; // Location1
      if (parts[8]) remarksText += (remarksText ? ' | ' : '') + parts[8]; // Location2
      
      return {
       PermitNumber: parts[0] || '',
//        DocumentNumber: parts[1] || '', // GateEntryNumber from scanner
        VendorInvoiceWeight: parts[2] || '',
        GrossWeight: parts[2] || '', // Same weight for both fields
        Material: parts[3] || '', // "Iron Ore"
        MaterialDescription: parts[4] || '', // "Fines 55-58%"
        VendorInvoiceNumber: parts[5] || '', // "MTE123930103"
        Location: parts[6] || '', // "Yerabanahalli - 5831305-58%"
        Remarks: remarksText,
        // Use current date/time since not provided in new format
  //      GateEntryDate: new Date().toISOString().split('T')[0],
  //      InwardTime: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}:${new Date().getSeconds().toString().padStart(2, '0')}`
      };
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (qrMode === 'camera') {
      startCameraScanning();
    }
    return () => {
      if (qrMode === 'camera') {
        stopCamera();
      }
    };
  }, [qrMode]);

  // External Barcode Scanner Listener - Enhanced with visual feedback
  useEffect(() => {
    let buffer = '';
    let timeout = null;
    let isProcessing = false;

    const handleKeyPress = (e) => {
      // Ignore if user is typing in an input field or textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Prevent default to avoid text appearing on screen
      if (buffer.length > 0 || e.key === 'Enter') {
        e.preventDefault();
      }

      // Clear previous timeout
      if (timeout) clearTimeout(timeout);

      // Check if Enter key (barcode scanner sends Enter at the end)
      if (e.key === 'Enter') {
        if (buffer.length > 5 && !isProcessing) {
          isProcessing = true;
          console.log('🔍 External Scanner detected:', buffer);
          
          // Show processing feedback
          setScanning(true);
          setResult('⏳ Processing scanned data...');
          
          // Small delay to ensure state updates
          setTimeout(() => {
            handleQRScanSuccess(buffer);
            buffer = '';
            isProcessing = false;
            setScanning(false);
          }, 100);
        } else {
          buffer = ''; // Clear if too short
        }
      } else if (e.key.length === 1) {
        // Accumulate characters (barcode scanners type very fast)
        buffer += e.key;
        
        // Auto-clear buffer after 100ms of inactivity
        timeout = setTimeout(() => {
          if (buffer.length < 5) {
            console.log('Buffer cleared - incomplete scan:', buffer);
          }
          buffer = '';
          isProcessing = false;
        }, 100);
      }
    };

    // Add event listener with capture phase to catch all keypresses
    window.addEventListener('keypress', handleKeyPress, true);

    // Cleanup
    return () => {
      window.removeEventListener('keypress', handleKeyPress, true);
      if (timeout) clearTimeout(timeout);
    };
  }, []); // Keep empty - scanner should always be active

  const transformDataForAPI = (data) => {
    const transformed = { ...data };

    const normalizeDecimalString = (val) => {
      if (val === '' || val === null || val === undefined) return null;
      const s = String(val).trim().replace(/,/g, '');
      const normalized = s.replace(/\s+/g, '').replace(',', '.');
      if (/^-?\d+(\.\d+)?$/.test(normalized)) {
        return normalized;
      }
      return null;
    };

    for (let i = 1; i <= 5; i++) {
      const suffix = i === 1 ? "" : String(i);
      const weightField = `VendorInvoiceWeight${suffix}`;
      const qtyField = `BalanceQty${suffix}`;
      transformed[weightField] = normalizeDecimalString(transformed[weightField]);
      transformed[qtyField] = normalizeDecimalString(transformed[qtyField]);
    }

    // Normalize weight fields
    transformed.GrossWeight = normalizeDecimalString(transformed.GrossWeight);
    transformed.TruckCapacity = normalizeDecimalString(transformed.TruckCapacity);
    transformed.EWayBill = Boolean(transformed.EWayBill);
    
    return transformed;
  };

  const hhmmssToSapDuration = (val) => {
    if (!val) return null;
    if (typeof val === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(val)) {
      const [h, m, s] = val.split(':').map(v => parseInt(v, 10));
      return `PT${h}H${m}M${s}S`;
    }
    if (val instanceof Date) {
      return formatTimeToSapDuration(val);
    }
    return String(val);
  };

  const extractErrorMessage = (err) => {
    const resp = err?.response?.data;
    if (!resp) return err?.message || String(err);
    if (typeof resp.error === 'string') return resp.error;
    if (resp.error?.message?.value) return resp.error.message.value;
    if (resp.error?.message && typeof resp.error.message === 'string') return resp.error.message;
    if (resp.message && typeof resp.message === 'string') return resp.message;
    return JSON.stringify(resp);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let updatedHeader = { ...header };

      // Generate numbers only if missing
      if (!updatedHeader.GateEntryNumber) {
        const year = updatedHeader.GateEntryDate ? updatedHeader.GateEntryDate.slice(0, 4) : currentYear;
        const gateResp = await fetchNextGateNumber(year, series);
        updatedHeader.GateEntryNumber = gateResp?.data?.next || `${year}${series === '2' ? 2 : 'SD'}0000001`;
      }
      if (!updatedHeader.WeightDocNumber) {
        const year = updatedHeader.GateEntryDate ? updatedHeader.GateEntryDate.slice(0, 4) : currentYear;
        const weightResp = await fetchNextWeightDocNumber(year, 4);
        updatedHeader.WeightDocNumber = weightResp?.data?.next || `${year}40000001`;
      }

      setHeader(updatedHeader); // Update state so UI reflects new numbers

      const inbound = updatedHeader.InwardTime || `${new Date().getHours().toString().padStart(2,'0')}:${new Date().getMinutes().toString().padStart(2,'0')}:${new Date().getSeconds().toString().padStart(2,'0')}`;
      const outbound = updatedHeader.OutwardTime || inbound;

      // STEP 1: Create Gate Entry
      const gatePayload = {
        ...updatedHeader,
        GateEntryDate: `${updatedHeader.GateEntryDate}T00:00:00`,
        InwardTime: hhmmssToSapDuration(updatedHeader.InwardTime || inbound),
        OutwardTime: pageMode === "outward" ? hhmmssToSapDuration(outbound) : (updatedHeader.OutwardTime ? hhmmssToSapDuration(updatedHeader.OutwardTime) : null),
        SAP_CreatedDateTime: nowIso(),
        FiscalYear: updatedHeader.FiscalYear || currentYear
      };

      const transformedGatePayload = transformDataForAPI(gatePayload);
      
      // Remove weight-specific fields from gate entry
      delete transformedGatePayload.WeightDocNumber;
      delete transformedGatePayload.GrossWeight;
      delete transformedGatePayload.TruckCapacity;
      
      console.debug('Creating Gate Entry:', transformedGatePayload);
      await createHeader(transformedGatePayload);
      console.log(`✅ Gate Entry created: ${updatedHeader.GateEntryNumber}`);

      // STEP 2: Create Material Inward (Weight Document) - ONLY if GrossWeight is provided
      if (updatedHeader.GrossWeight && updatedHeader.GrossWeight.trim() !== '') {
        const weightPayload = {
          WeightDocNumber: updatedHeader.WeightDocNumber,
          FiscalYear: updatedHeader.FiscalYear || currentYear,
          Indicators: 'I',
          GateEntryNumber: updatedHeader.GateEntryNumber,
          GateFiscalYear: updatedHeader.FiscalYear || currentYear,
          GateIndicators: 'I',
          GateEntryDate: `${updatedHeader.GateEntryDate}T00:00:00`,
          TruckNumber: updatedHeader.VehicleNumber,
          TruckCapacity: updatedHeader.TruckCapacity || null,
          PermitNumber: updatedHeader.PermitNumber || null,
          GrossWeight: updatedHeader.GrossWeight,
          SAP_CreatedDateTime: nowIso(),
          // Copy PO fields (same as before)
          PurchaseOrderNumber: updatedHeader.PurchaseOrderNumber || null,
          PurchaseOrderNumber2: updatedHeader.PurchaseOrderNumber2 || null,
          PurchaseOrderNumber3: updatedHeader.PurchaseOrderNumber3 || null,
          PurchaseOrderNumber4: updatedHeader.PurchaseOrderNumber4 || null,
          PurchaseOrderNumber5: updatedHeader.PurchaseOrderNumber5 || null,
          Material: updatedHeader.Material || null,
          Material2: updatedHeader.Material2 || null,
          Material3: updatedHeader.Material3 || null,
          Material4: updatedHeader.Material4 || null,
          Material5: updatedHeader.Material5 || null,
          MaterialDescription: updatedHeader.MaterialDescription || null,
          MaterialDescription2: updatedHeader.MaterialDescription2 || null,
          MaterialDescription3: updatedHeader.MaterialDescription3 || null,
          MaterialDescription4: updatedHeader.MaterialDescription4 || null,
          MaterialDescription5: updatedHeader.MaterialDescription5 || null,
          Vendor: updatedHeader.Vendor || null,
          Vendor2: updatedHeader.Vendor2 || null,
          Vendor3: updatedHeader.Vendor3 || null,
          Vendor4: updatedHeader.Vendor4 || null,
          Vendor5: updatedHeader.Vendor5 || null,
          VendorName: updatedHeader.VendorName || null,
          VendorName2: updatedHeader.VendorName2 || null,
          VendorName3: updatedHeader.VendorName3 || null,
          VendorName4: updatedHeader.VendorName4 || null,
          VendorName5: updatedHeader.VendorName5 || null,
          VendorInvoiceNumber: updatedHeader.VendorInvoiceNumber || null,
          VendorInvoiceNumber2: updatedHeader.VendorInvoiceNumber2 || null,
          VendorInvoiceNumber3: updatedHeader.VendorInvoiceNumber3 || null,
          VendorInvoiceNumber4: updatedHeader.VendorInvoiceNumber4 || null,
          VendorInvoiceNumber5: updatedHeader.VendorInvoiceNumber5 || null,
          VendorInvoiceWeight: updatedHeader.VendorInvoiceWeight || null,
          VendorInvoiceWeight2: updatedHeader.VendorInvoiceWeight2 || null,
          VendorInvoiceWeight3: updatedHeader.VendorInvoiceWeight3 || null,
          VendorInvoiceWeight4: updatedHeader.VendorInvoiceWeight4 || null,
          VendorInvoiceWeight5: updatedHeader.VendorInvoiceWeight5 || null,
          BalanceQty: updatedHeader.BalanceQty || null,
          BalanceQty2: updatedHeader.BalanceQty2 || null,
          BalanceQty3: updatedHeader.BalanceQty3 || null,
          BalanceQty4: updatedHeader.BalanceQty4 || null,
          BalanceQty5: updatedHeader.BalanceQty5 || null,
        };

        // Handle VendorInvoiceDate fields
        for (let i = 1; i <= 5; i++) {
          const suffix = i === 1 ? '' : String(i);
          const dateField = `VendorInvoiceDate${suffix}`;
          if (updatedHeader[dateField] && updatedHeader[dateField].length === 10) {
            weightPayload[dateField] = `${updatedHeader[dateField]}T00:00:00`;
          }
        }

        const transformedWeightPayload = transformDataForAPI(weightPayload);
        // Remove fields that don't belong to Weight Document entity
        delete transformedWeightPayload.EWayBill;
        delete transformedWeightPayload.TransporterCode;
        delete transformedWeightPayload.TransporterName;
        delete transformedWeightPayload.DriverName;
        delete transformedWeightPayload.DriverPhoneNumber;
        delete transformedWeightPayload.LRGCNumber;
        delete transformedWeightPayload.PermitNumber;
        delete transformedWeightPayload.Division;
        delete transformedWeightPayload.Remarks;
        delete transformedWeightPayload.SubTransporterName;
        delete transformedWeightPayload.InwardTime;
        delete transformedWeightPayload.OutwardTime;
        delete transformedWeightPayload.VehicleNumber;
        // Remove empty fields
        Object.keys(transformedWeightPayload).forEach(key => {
          if (transformedWeightPayload[key] === '' || transformedWeightPayload[key] === null || transformedWeightPayload[key] === undefined) {
            delete transformedWeightPayload[key];
          }
        });

        console.debug('Creating Weight Document:', transformedWeightPayload);
        await createMaterialInward(transformedWeightPayload);
        console.log(`✅ Weight Document created: ${updatedHeader.WeightDocNumber}`);
        setResult(`✅ Gate Entry (${updatedHeader.GateEntryNumber}) + Weight Document (${updatedHeader.WeightDocNumber}) created successfully!`);
        sendEmailNotification({
          gateEntryNumber: updatedHeader.GateEntryNumber,
          weightDocNumber: updatedHeader.WeightDocNumber,
          vehicleNumber: updatedHeader.VehicleNumber,
          grossWeight: updatedHeader.GrossWeight,
          date: updatedHeader.GateEntryDate
        }).catch(err => console.warn('Email notification failed:', err));
      } else {
        setResult(`✅ Gate Entry (${updatedHeader.GateEntryNumber}) created successfully!`);
      }
      // Do not auto-reset the form after submit; user can reset manually
    } catch (err) {
      console.error('Submit error:', err?.response?.data || err);
      const msg = extractErrorMessage(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setHeader(createInitialHeaderState());
    setError(null);
    setResult(null);
  };

  const location = useLocation();
  const pathTail = location.pathname.split("/").pop();
  const pageMode = pathTail === "inward" ? "inward" : (pathTail === "outward" ? "outward" : "default");

  useEffect(() => {
    if (pageMode === "inward") {
      const hh = String(new Date().getHours()).padStart(2, "0");
      const mm = String(new Date().getMinutes()).padStart(2, "0");
      const ss = String(new Date().getSeconds()).padStart(2, "0");
      setHeader(h => ({ ...h, InwardTime: `${hh}:${mm}:${ss}`, OutwardTime: "" }));
    }
    if (pageMode === "outward") {
      setHeader(h => ({ ...h, OutwardTime: "" }));
    }
  }, [pageMode]);

  // Auto-parse remarks and map fields if remarks is pipe-delimited and not already mapped
  useEffect(() => {
    if (header.Remarks && (header.Remarks.match(/\|/g) || []).length >= 4) {
      // Avoid infinite loop: only parse if at least one mapped field is empty or different
      const fields = parseQRRemarks(header.Remarks);
      // Only update if at least one field is not already set
      if (
        (!header.VendorInvoiceNumber && fields.VendorInvoiceNumber) ||
        (!header.VehicleNumber && fields.TruckNumber) ||
        (!header.Material && fields.material) ||
        (!header.MaterialDescription && fields.grade) ||
        (!header.GrossWeight && fields.VendorInvoiceWeight)
      ) {
        setHeader(prev => ({
          ...prev,
          PermitNumber: fields.PermitNumber || prev.PermitNumber,
          VendorInvoiceNumber: fields.VendorInvoiceNumber || prev.VendorInvoiceNumber,
          VendorInvoiceWeight: fields.VendorInvoiceWeight || prev.VendorInvoiceWeight,
          GrossWeight: fields.VendorInvoiceWeight || prev.GrossWeight,
          GateEntryDate: fields.GateEntryDate || prev.GateEntryDate,
          VehicleNumber: fields.TruckNumber || prev.VehicleNumber,
          LRGCNumber: fields.mteNumber || prev.LRGCNumber,
          Material: fields.material || prev.Material,
          MaterialDescription: fields.grade || prev.MaterialDescription,
          Division: fields.location || prev.Division,
          // Remarks: prev.Remarks // don't overwrite
        }));
      }
    }
  }, [header.Remarks]);

  return (
    <div className="create-header-container">
      <h2 className="page-title">
        {pageMode === "inward" ? "Create Gate Entry + Weight (Inward)" : 
         pageMode === "outward" ? "Create Gate Entry (Outward)" : 
         "Create Gate Entry + Weight Document"}
      </h2>

      {/* External Scanner Status Indicator */}
      <div style={{
        textAlign: 'center',
        marginBottom: '20px',
        padding: '16px 24px',
        background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
        borderRadius: '16px',
        boxShadow: '0 6px 20px rgba(34, 197, 94, 0.3)',
        border: '2px solid rgba(255, 255, 255, 0.3)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          color: 'white',
          fontSize: '1.15rem',
          fontWeight: '600'
        }}>
          <span style={{ fontSize: '1.8rem' }}>🔫</span>
          <span>External Barcode Scanner Active</span>
          <span style={{
            width: '14px',
            height: '14px',
            background: '#dcfce7',
            borderRadius: '50%',
            boxShadow: '0 0 12px #10b981, inset 0 0 4px #10b981',
            animation: 'pulse 2s infinite'
          }}></span>
        </div>
        <p style={{ 
          margin: '10px 0 0', 
          fontSize: '0.95rem', 
          color: 'rgba(255, 255, 255, 0.95)',
          fontWeight: '500'
        }}>
          👉 Point scanner at QR code and press trigger - Data will auto-fill
        </p>
      </div>

      {/* QR Scanner Buttons */}
      <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '30px', flexWrap: 'wrap' }}>
        <button 
          type="button"
          onClick={() => { setShowQRScanner(true); setQrMode('camera'); }}
          style={{
            padding: '14px 28px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '1.05rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
          }}
        >
          📷 Scan QR with Camera
        </button>

        <button 
          type="button"
          onClick={() => { setShowQRScanner(true); setQrMode('upload'); setTimeout(() => fileInputRef.current?.click(), 100); }}
          style={{
            padding: '14px 28px',
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontSize: '1.05rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 6px 20px rgba(245, 87, 108, 0.4)',
          }}
        >
          📤 Upload QR Image
        </button>
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }} onClick={() => { setShowQRScanner(false); setQrMode(null); stopCamera(); }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: '24px',
              borderBottom: '2px solid #e0e0e0',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: '16px 16px 0 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0 }}>🔍 Scan QR Code</h3>
              <button onClick={() => { setShowQRScanner(false); setQrMode(null); stopCamera(); }} style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                fontSize: '2rem',
                color: 'white',
                cursor: 'pointer',
                width: '40px',
                height: '40px',
                borderRadius: '8px'
              }}>×</button>
            </div>

            <div style={{ padding: '30px' }}>
              {qrMode === 'camera' ? (
                <div style={{ textAlign: 'center' }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{
                    width: '100%',
                    maxWidth: '480px',
                    borderRadius: '12px',
                    background: '#000'
                  }} />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                  <p style={{ marginTop: '20px', color: '#666' }}>📱 Position QR code within the frame</p>
                  {scanning && <p style={{ color: '#667eea', fontWeight: '600' }}>🔄 Scanning...</p>}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <button onClick={() => fileInputRef.current?.click()} disabled={scanning} style={{
                    padding: '14px 32px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '1.05rem',
                    fontWeight: '600',
                    cursor: scanning ? 'not-allowed' : 'pointer'
                  }}>
                    {scanning ? '⏳ Processing...' : '📁 Choose Image'}
                  </button>
                </div>
              )}

              {qrError && (
                <div style={{ marginTop: '20px', padding: '16px', background: '#ffebee', borderLeft: '4px solid #ef5350', borderRadius: '8px', color: '#c62828' }}>
                  <strong>⚠️ Error:</strong> {qrError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <section className="form-section">
          <h3 className="section-title">Header Information</h3>
          <div className="grid-3-cols">
            <div className="form-group">
              <label className="form-label">Gate Entry Number (Auto) *</label>
              <input className="form-input" name="GateEntryNumber" value={header.GateEntryNumber} readOnly style={{ background: '#f0f0f0' }} />
            </div>

            <div className="form-group">
              <label className="form-label">Weight Doc Number (Auto)</label>
              <input className="form-input" name="WeightDocNumber" value={header.WeightDocNumber} readOnly style={{ background: '#f0f0f0' }} />
            </div>

            <div className="form-group">
              <label className="form-label">Gate Entry Date *</label>
              <input className="form-input" name="GateEntryDate" type="date" value={header.GateEntryDate} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">Series</label>
              <select className="form-select" value={series} onChange={(e) => setSeries(e.target.value)}>
                <option value="2">MM</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Vehicle Number *</label>
              <input className="form-input" name="VehicleNumber" value={header.VehicleNumber} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label className="form-label">Gross Weight (MT)</label>
              <input className="form-input" name="GrossWeight" value={header.GrossWeight} onChange={handleChange} placeholder="60.000" />
            </div>

            <div className="form-group">
              <label className="form-label">Truck Capacity (MT)</label>
              <input className="form-input" name="TruckCapacity" value={header.TruckCapacity} onChange={handleChange} placeholder="50.000" />
            </div>

            <div className="form-group">
              <label className="form-label">Transporter Code</label>
              <input className="form-input" name="TransporterCode" value={header.TransporterCode} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label className="form-label">Transporter Name</label>
              <input className="form-input" name="TransporterName" value={header.TransporterName} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label className="form-label">Driver Name</label>
              <input className="form-input" name="DriverName" value={header.DriverName} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label className="form-label">Driver Phone</label>
              <input className="form-input" name="DriverPhoneNumber" value={header.DriverPhoneNumber} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label className="form-label">LR/GC Number</label>
              <input className="form-input" name="LRGCNumber" value={header.LRGCNumber} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label className="form-label">Permit Number</label>
              <input className="form-input" name="PermitNumber" value={header.PermitNumber} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label className="form-label">Sub Transporter Name</label>
              <input className="form-input" name="SubTransporterName" value={header.SubTransporterName} onChange={handleChange} />
            </div>

            <div className="form-group form-group-checkbox">
              <input type="checkbox" className="form-checkbox" name="EWayBill" checked={header.EWayBill} onChange={handleChange} />
              <label className="form-checkbox-label">E-Way Bill</label>
            </div>

            <div className="form-group">
              <label className="form-label">Division</label>
              <input className="form-input" name="Division" value={header.Division} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label className="form-label">Inward Time (auto)</label>
              <input className="form-input" name="InwardTime" value={header.InwardTime} readOnly />
            </div>

            <div className="form-group">
              <label className="form-label">Outward Time (will be set at submit)</label>
              <input className="form-input" name="OutwardTime" value={header.OutwardTime} readOnly />
            </div>

            <div className="form-group full-width">
              <label className="form-label">Remarks</label>
              <textarea className="form-textarea" name="Remarks" value={header.Remarks} onChange={handleChange} rows={2} />
            </div>
          </div>
        </section>

        <section className="form-section">
          <h3 className="section-title">Purchase Order Details</h3>
          {Array.from({ length: 5 }).map((_, idx) => {
            const suffix = idx === 0 ? "" : String(idx + 1);
            return (
              <div key={idx} className="po-entry-card">
                <h4 className="po-entry-title">PO Entry {idx + 1}</h4>
                <div className="grid-4-cols">
                  <div className="form-group">
                    <label className="form-label">PO Number</label>
                    <input className="form-input" name={`PurchaseOrderNumber${suffix}`} value={header[`PurchaseOrderNumber${suffix}`]} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Material</label>
                    <input className="form-input" name={`Material${suffix}`} value={header[`Material${suffix}`]} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Material Description</label>
                    <input className="form-input" name={`MaterialDescription${suffix}`} value={header[`MaterialDescription${suffix}`]} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vendor</label>
                    <input className="form-input" name={`Vendor${suffix}`} value={header[`Vendor${suffix}`]} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vendor Name</label>
                    <input className="form-input" name={`VendorName${suffix}`} value={header[`VendorName${suffix}`]} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vendor Invoice No</label>
                    <input className="form-input" name={`VendorInvoiceNumber${suffix}`} value={header[`VendorInvoiceNumber${suffix}`]} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vendor Invoice Date</label>
                    <input className="form-input" type="date" name={`VendorInvoiceDate${suffix}`} value={header[`VendorInvoiceDate${suffix}`]} onChange={handleChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vendor Invoice Weight</label>
                    <input className="form-input" name={`VendorInvoiceWeight${suffix}`} type="text" inputMode="decimal" value={header[`VendorInvoiceWeight${suffix}`]} onChange={handleChange} placeholder="0.00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Balance Quantity</label>
                    <input className="form-input" name={`BalanceQty${suffix}`} type="text" inputMode="decimal" value={header[`BalanceQty${suffix}`]} onChange={handleChange} placeholder="0.000" />
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <div className="form-actions">
          <button type="submit" disabled={loading} className={`btn btn-primary ${loading ? 'disabled' : ''}`}>
            {loading ? "Creating..." : "✅ Create Gate Entry + Weight Document"}
          </button>
          <button type="button" onClick={resetForm} className="btn btn-secondary">Reset Form</button>
        </div>
      </form>

      {error && (<div className="error-message"><strong>❌ Error:</strong> {error}</div>)}
      {result && (
        <div className="success-message">
          <div className="success-header">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <h3>Success!</h3>
          </div>
          <div className="success-content">
            <p><strong>{result}</strong></p>
            {header.GateEntryNumber && (
              <>
                <p>Gate Entry Number: <strong>{header.GateEntryNumber}</strong></p>
                <p>Weight Doc Number: <strong>{header.WeightDocNumber}</strong></p>
                <p>Vehicle: {header.VehicleNumber}</p>
                {header.GrossWeight && <p>Gross Weight: {header.GrossWeight} MT</p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function parseQRRemarks(remarks) {
  // Log the raw input for debugging
  console.log('Raw remarks:', remarks);

  // Split by pipe with optional spaces around it
  const parts = remarks.split(/\s*\|\s*/).map(s => s.trim());
  console.log('Split parts:', parts);

  // Map to fields (adjust as per your QR format)
  return {
    PermitNumber: parts[0] || '',
    VendorInvoiceNumber: parts[1] || '',
    VendorInvoiceWeight: parts[2] || '',
    GateEntryDate: parts[3] || '',
    TruckNumber: parts[4] || '',
    vehicleType: parts[5] || '',
    material: parts[6] || '',
    grade: parts[7] || '',
    mteNumber: parts[8] || '',
    location: parts[9] || ''
  };
}

// Example usage:
const remarks = "25267031B000010 | 25267031T004063 | 19.26 | 16/10/2025 9:23 PM | KA35D 7399 | Tipper | Iron Ore | Fines 55-58% | MTE123930103 | Yerabanahalli - 583130";
const fields = parseQRRemarks(remarks);
console.log(fields);

const handleQRRemarks = (remarks) => {
  const fields = parseQRRemarks(remarks);
  setHeader(prev => ({
    ...prev,
    PermitNumber: fields.PermitNumber || prev.PermitNumber,
    VendorInvoiceNumber: fields.VendorInvoiceNumber || prev.VendorInvoiceNumber,
    VendorInvoiceWeight: fields.VendorInvoiceWeight || prev.VendorInvoiceWeight,
    GrossWeight: fields.VendorInvoiceWeight || prev.GrossWeight,
    GateEntryDate: fields.GateEntryDate || prev.GateEntryDate,
    VehicleNumber: fields.TruckNumber || prev.VehicleNumber,
    LRGCNumber: fields.mteNumber || prev.LRGCNumber,
    Material: fields.material || prev.Material,
    MaterialDescription: fields.grade || prev.MaterialDescription,
    Division: fields.location || prev.Division,
    Remarks: remarks
  }));
};