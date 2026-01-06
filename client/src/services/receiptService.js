/**
 * Receipt Service - PDF Generation and Management
 * Handles PDF receipt generation with MyTabs branding and QR codes
 */

class ReceiptService {
  /**
   * Generate PDF receipt for a ticket purchase
   * @param {Object} purchase - Purchase data
   * @param {Object} event - Event data
   * @returns {Promise<Blob>} PDF blob
   */
  async generatePDFReceipt(purchase, event) {
    try {
      // Create PDF content structure
      const receiptData = this.buildReceiptData(purchase, event);
      
      // For now, simulate PDF generation with a text-based receipt
      // In production, this would use a PDF library like jsPDF or PDFKit
      const pdfContent = this.createTextReceipt(receiptData);
      
      // Create blob for download
      const blob = new Blob([pdfContent], { type: 'application/pdf' });
      return blob;
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw new Error('Failed to generate PDF receipt');
    }
  }

  /**
   * Build structured receipt data
   * @param {Object} purchase - Purchase data
   * @param {Object} event - Event data
   * @returns {Object} Structured receipt data
   */
  buildReceiptData(purchase, event) {
    const currentDate = new Date().toLocaleString();
    
    return {
      // MyTabs branding
      company: {
        name: 'MyTabs',
        tagline: 'Your Social Events Platform',
        website: 'www.mytabs.com',
        support: 'support@mytabs.com'
      },
      
      // Receipt metadata
      receipt: {
        number: `RCP-${purchase.confirmationNumber}`,
        date: currentDate,
        transactionId: purchase.confirmationNumber,
        paymentMethod: purchase.paymentMethod
      },
      
      // Customer information
      customer: {
        name: purchase.customerName,
        email: purchase.customerEmail,
        phone: '+1 (555) 123-4567' // Mock phone
      },
      
      // Event details
      event: {
        name: event?.eventName || 'Sample Event',
        date: event?.eventDate || '2025-12-11',
        time: event?.eventTime || '7:00 PM',
        location: event?.location || '123 Main St, Houston, TX',
        venue: 'Event Venue'
      },
      
      // Purchase details
      purchase: {
        tickets: purchase.ticketDetails,
        quantity: this.extractQuantity(purchase.ticketDetails),
        unitPrice: this.calculateUnitPrice(purchase.totalAmount, purchase.ticketDetails),
        subtotal: purchase.totalAmount,
        serviceFee: '1.75',
        processingFee: '1.03',
        tax: '2.33',
        total: purchase.totalAmount
      },
      
      // QR code information
      qrCode: {
        data: `MYTABS-${purchase.confirmationNumber}-${event?.eventId || 'evt_001'}`,
        instructions: 'Present this QR code at event entry'
      }
    };
  }

  /**
   * Create text-based receipt (simulates PDF content)
   * @param {Object} data - Receipt data
   * @returns {string} Formatted receipt text
   */
  createTextReceipt(data) {
    return `
═══════════════════════════════════════════════════════════════
                            ${data.company.name}
                    ${data.company.tagline}
                        ${data.company.website}
═══════════════════════════════════════════════════════════════

                          TICKET RECEIPT
                      Receipt #: ${data.receipt.number}

───────────────────────────────────────────────────────────────
EVENT INFORMATION
───────────────────────────────────────────────────────────────
Event:          ${data.event.name}
Date & Time:    ${data.event.date} at ${data.event.time}
Location:       ${data.event.location}
Venue:          ${data.event.venue}

───────────────────────────────────────────────────────────────
CUSTOMER INFORMATION
───────────────────────────────────────────────────────────────
Name:           ${data.customer.name}
Email:          ${data.customer.email}
Phone:          ${data.customer.phone}

───────────────────────────────────────────────────────────────
PURCHASE DETAILS
───────────────────────────────────────────────────────────────
Tickets:        ${data.purchase.tickets}
Quantity:       ${data.purchase.quantity}
Unit Price:     $${data.purchase.unitPrice}

Subtotal:       $${data.purchase.subtotal}
Service Fee:    $${data.purchase.serviceFee}
Processing Fee: $${data.purchase.processingFee}
Tax:           $${data.purchase.tax}
                ─────────────
TOTAL:         $${data.purchase.total}

───────────────────────────────────────────────────────────────
PAYMENT INFORMATION
───────────────────────────────────────────────────────────────
Payment Method: ${data.receipt.paymentMethod}
Transaction ID: ${data.receipt.transactionId}
Date Processed: ${data.receipt.date}
Status:         PAID

───────────────────────────────────────────────────────────────
QR CODE FOR EVENT ENTRY
───────────────────────────────────────────────────────────────

    ████ ████ ████ ████ ████ ████ ████ ████
    ████ ████ ████ ████ ████ ████ ████ ████
    ████ ████ ████ ████ ████ ████ ████ ████
    ████ ████ ████ ████ ████ ████ ████ ████
    ████ ████ ████ ████ ████ ████ ████ ████
    ████ ████ ████ ████ ████ ████ ████ ████

QR Data: ${data.qrCode.data}
${data.qrCode.instructions}

───────────────────────────────────────────────────────────────
IMPORTANT INFORMATION
───────────────────────────────────────────────────────────────
• Please arrive 30 minutes before event start time
• Present this receipt or QR code for entry
• No refunds after event date
• For support, contact: ${data.company.support}
• Keep this receipt for your records

───────────────────────────────────────────────────────────────
Thank you for choosing ${data.company.name}!
Visit ${data.company.website} for more events
───────────────────────────────────────────────────────────────

Generated: ${data.receipt.date}
Receipt #: ${data.receipt.number}

═══════════════════════════════════════════════════════════════
`;
  }

  /**
   * Extract quantity from ticket details string
   * @param {string} ticketDetails - e.g., "General Admission x1"
   * @returns {string} Quantity
   */
  extractQuantity(ticketDetails) {
    const match = ticketDetails.match(/x(\d+)/);
    return match ? match[1] : '1';
  }

  /**
   * Calculate unit price from total and ticket details
   * @param {string} totalAmount - Total amount
   * @param {string} ticketDetails - Ticket details
   * @returns {string} Unit price
   */
  calculateUnitPrice(totalAmount, ticketDetails) {
    const quantity = parseInt(this.extractQuantity(ticketDetails));
    const total = parseFloat(totalAmount);
    const unitPrice = (total / quantity).toFixed(2);
    return unitPrice;
  }

  /**
   * Download PDF receipt
   * @param {Object} purchase - Purchase data
   * @param {Object} event - Event data
   */
  async downloadReceipt(purchase, event) {
    try {
      const pdfBlob = await this.generatePDFReceipt(purchase, event);
      
      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `MyTabs-Receipt-${purchase.confirmationNumber}.pdf`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Receipt download failed:', error);
      throw error;
    }
  }

  /**
   * Email receipt to customer
   * @param {Object} purchase - Purchase data
   * @param {Object} event - Event data
   * @returns {Promise<boolean>} Success status
   */
  async emailReceipt(purchase, event) {
    try {
      // Simulate email sending
      const receiptData = this.buildReceiptData(purchase, event);
      
      // In production, this would call the backend email service
      console.log('Sending receipt email to:', receiptData.customer.email);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true;
    } catch (error) {
      console.error('Email receipt failed:', error);
      throw error;
    }
  }

  /**
   * Get receipt history for a customer
   * @param {string} customerEmail - Customer email
   * @returns {Array} Receipt history
   */
  getReceiptHistory(customerEmail) {
    // Mock receipt history
    return [
      {
        receiptNumber: 'RCP-ABC123',
        date: '2025-12-11',
        event: 'Sample Event',
        amount: '$30.11',
        status: 'Sent'
      },
      {
        receiptNumber: 'RCP-DEF456',
        date: '2025-11-15',
        event: 'Previous Event',
        amount: '$25.00',
        status: 'Sent'
      }
    ];
  }
}

// Export singleton instance
export default new ReceiptService();