import axios from 'axios';
export const API_BASE = 'http://localhost:4600/api';
//export const API_BASE = 'https://gateentry.cfapps.ap21.hana.ondemand.com/api';
//export const API_BASE = 'https://gateentry-backend.onrender.com/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(cfg => {
  console.log(`>> ${cfg.method?.toUpperCase()} ${cfg.url}`, cfg.data || cfg.params || {});
  return cfg;
});

api.interceptors.response.use(
  r => { console.log('<<', r.status, r.data); return r; },
  err => { console.error('API ERR', err?.response?.status, err?.response?.data || err.message); return Promise.reject(err); }
);

// Gate Entry functions
export function createHeader(payload) { 
  return api.post('/headers', payload); 
}

export function fetchNextGateNumber(year, code) {
  const params = {};
  if (year) params.year = year;
  if (code) params.code = code;
  const qs = new URLSearchParams(params).toString();
  return api.get(`/next-gatenumber?${qs}`);
}

// Material Movement functions
export function createMaterialInward(payload) {
  return api.post('/headers/material/in', payload);
}

export function createMaterialOutward(payload) {
  return api.post('/headers/material/out', payload);
}

export function createWeight(payload) {
  return api.post('/headers/material/in', payload);
}

export function fetchNextMaterialNumber(year, code) {
  const params = {};
  if (year) params.year = year;
  if (code) params.code = code;
  const qs = new URLSearchParams(params).toString();
  return api.get(`/next-materialnumber?${qs}`);
}

// Weight Doc Number - unified function with optional code parameter
export const fetchNextWeightDocNumber = (year, code) => {
  const params = new URLSearchParams();
  if (year) params.set('year', year);
  if (code != null) params.set('code', String(code));
  return api.get(`/next-weightnumber?${params.toString()}`);
};

// Alias for backward compatibility (optional)
export function fetchNextWeightNumber(year, code) {
  return fetchNextWeightDocNumber(year, code);
}

// Gate Entry lookup
export const fetchGateEntryByNumber = (gateEntryNumber) => {
  const filter = `$filter=GateEntryNumber eq '${gateEntryNumber}'&$format=json`;
  return api.get(`/headers?${filter}`);
};

export const updateHeaderByUUID = (uuid, data) =>
  api.patch(`/headers/${uuid}`, data);

// Fetch Material Inward by Gate Entry Number
// USE THE CORRECT ENDPOINT - singular "header" not "headers"
export const fetchMaterialInwardByGateNumber = (gateEntryNumber) => {
  // Send as query parameter to the WORKING backend endpoint
  return api.get(`/header/weightdetails?gateEntryNumber=${gateEntryNumber}`);
};

// Update Material Inward (for tare weight capture)
// ALSO FIX THIS - needs to match backend PATCH route
export function updateMaterialInward(uuid, payload) {
  // Clean UI-only fields
  const cleanPayload = { ...payload };
  delete cleanPayload._docType;
  delete cleanPayload.SAP_UUID;
  return api.patch(`/headers/material/${uuid}`, cleanPayload);
}
export function updateobdMaterialOutward(uuid, payload) {
  // Clean UI-only fields
  const cleanPayload = { ...payload };
  delete cleanPayload._docType;
  delete cleanPayload.SAP_UUID;
  return api.patch(`/headers/material/obd/${uuid}`, cleanPayload);
} 

// Fetch Material Outward by Gate Entry Number (Indicators='O')
export const fetchMaterialOutwardByGateNumber = (gateEntryNumber) => {
  // Send as query parameter - backend will filter for Indicators='O'
  return api.get(`/header/weightdetails/outward?gateEntryNumber=${gateEntryNumber}`);
};


//Fetch details based on Vendor Invoice Number
export const fetchWeightDetailsByVendorInvoiceNumber = (VendorInvoiceNumber) => { 
  return api.get(`/weightdetails/vendorinvoice/${VendorInvoiceNumber}`);
};

/**
 * Update only outward completion fields.
 * uuid: GUID of the header entity
 * payloadExtras: allow extension (e.g. Status flag) if needed
 */
export function updateGateEntryOutward(uuid, payloadExtras = {}) {
  const nowIso = new Date().toISOString();
  const today = new Date().toISOString().split('T')[0];
  const hh = String(new Date().getHours()).padStart(2, '0');
  const mm = String(new Date().getMinutes()).padStart(2, '0');
  const ss = String(new Date().getSeconds()).padStart(2, '0');
  const outwardTime = `${hh}:${mm}:${ss}`;

  const body = {
    OutwardTime: outwardTime,
    GateOutDate: today,           // Include if SAP model has this field
    SAP_ModifiedDateTime: nowIso, // If you track modified timestamp
    ...payloadExtras
  };
  return api.patch(`/headers/${uuid}`, body);
}

export function ITPPDFGenerate(id, payload) {
  return api.post(`/headers/${id}/pdf`, payload, { responseType: 'blob' });
}

export function initialRegistration(payload) { 
  return api.post('/initial-registration', payload); 
}
// ...existing imports and code...

export function fetchInitialRegistrations(params = {}) {
  // params: { top?: number, search?: string, count?: boolean }
  const searchParams = new URLSearchParams();
  if (params.top) searchParams.set('top', String(params.top));
  if (params.search) searchParams.set('search', params.search);
  if (params.count != null) searchParams.set('count', String(!!params.count));
  const qs = searchParams.toString();
  return api.get(`/initial-registrations${qs ? `?${qs}` : ''}`);
}

export function fetchTruckRegistrations(params = {}) {
  // params: { top?: number, search?: string, count?: boolean }
  const searchParams = new URLSearchParams();
  if (params.top) searchParams.set('top', String(params.top));
  if (params.search) searchParams.set('search', params.search);
  if (params.count != null) searchParams.set('count', String(!!params.count));
  const qs = searchParams.toString();
  return api.get(`/truck-registrations${qs ? `?${qs}` : ''}`);
}

// Add PATCH to update Initial Registration (e.g., change Status)
export function updateInitialRegistration(uuid, payload) {
  return api.patch(`/initial-registration/${uuid}`, payload);
}

export function userCrenditials(username, password) {
  return api.post('/user-credentials', { username, password });
}
// Add this export at the end of api.jsx
export function sendEmailNotification(payload) {
  return api.post('/send-notification', payload);
}

// Add this before the export default api line (around line 140):

// Fetch Purchase Order details by PO Number
export function fetchPurchaseOrderByNumber(poNumber) {
  return api.get(`/purchaseorder/${poNumber}`);
}

export function fetchPurchaseOrderSuggestions(search) {
  return api.get(`/po-suggestions?query=${encodeURIComponent(search)}`);
}

// Fetch PO details by Permit Number (new endpoint)
export function fetchPurchaseOrderByPermitNumber(permitNumber) {
  return api.get(`/po-permitnumber/${permitNumber}`);
}

// export function fetchPurchaseOrderSuggestions(search) {
//   return api.get(`/purchaseorders?search=${encodeURIComponent(search)}`);
// }
// Fetch Sales Order details by SO Number
// Fetch SO suggestions by partial number
export function fetchSalesOrderSuggestions(search) {
  return api.get(`/salesorders?search=${encodeURIComponent(search)}`);
}

export function fetchSalesOrderByNumber(soNumber) {
  return api.get(`/salesorders/${soNumber}`);
}

export function createOutboundDelivery(payload) {
  return api.post('/outbounddelivery', payload);
}

//Version 3: OBD and Material Outward Create
export function createOBDandMaterialOutwardCreate(payload) {
  return api.post('/materialoutward-full', payload);
}

export function updateOutboundDelivery(deliveryDocument, itemNumber, payload) {
  return api.patch(`/outbounddelivery/${deliveryDocument}/items/${itemNumber}`, payload);
}

// export function createGoodsIssue(payload) {
//   return api.post('/goodsissue-and-invoice', payload);
// }
export function createGoodsIssue(payload, options = {}) {
  return api.post('/goodsissue-and-invoice', payload, options);
}


export default api;