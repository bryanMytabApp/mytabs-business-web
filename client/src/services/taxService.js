import axios from 'axios';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://16psjhr9ni.execute-api.us-east-1.amazonaws.com/prod';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Calculate tax for a given amount and event location
export const calculateTax = async (amount, eventLocation) => {
  try {
    console.log('🧮 Calculating tax for event location:', { amount, eventLocation });
    
    const response = await api.post('/payments/calculate-tax', {
      amount,
      currency: 'usd',
      eventLocation // Changed from customerAddress to eventLocation
    });
    
    console.log('🧮 Tax calculation response:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('Error calculating tax:', error);
    
    // Handle different error scenarios
    if (axios.isAxiosError && axios.isAxiosError(error)) {
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        // Check if it's a CORS error
        if (error.config?.url?.includes('calculate-tax')) {
          console.log('🧮 CORS error detected - backend needs deployment or local server not running');
          return {
            success: false,
            taxAmount: 0,
            totalAmount: amount,
            taxBreakdown: [],
            error: 'Tax service temporarily unavailable'
          };
        }
        
        // Network error - return zero tax
        console.log('🧮 Network error - returning zero tax');
        return {
          success: false,
          taxAmount: 0,
          totalAmount: amount,
          taxBreakdown: [],
          error: 'Tax calculation service unavailable'
        };
      }
      
      if (error.response?.status === 400) {
        throw new Error(error.response?.data?.error || 'Invalid tax calculation request');
      }
      
      throw new Error(error.response?.data?.error || 'Tax calculation service error');
    }
    
    throw new Error('Failed to calculate tax');
  }
};

// Validate event location for tax calculation
export const validateLocationForTax = (location) => {
  return !!(
    location?.line1 &&
    location?.city &&
    location?.state &&
    location?.postal_code
  );
};

// Format tax breakdown for display
export const formatTaxBreakdown = (taxBreakdown) => {
  if (!taxBreakdown || taxBreakdown.length === 0) {
    return 'No tax applicable';
  }
  
  return taxBreakdown
    .map(breakdown => `${breakdown.jurisdiction?.display_name || 'Tax'}: ${(breakdown.tax_rate_details?.rate * 100 || 0).toFixed(2)}%`)
    .join(', ');
};