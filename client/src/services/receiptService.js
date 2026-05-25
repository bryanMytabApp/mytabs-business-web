/**
 * Receipt Service - PDF Generation and Management
 * Handles PDF receipt generation with MyTabs branding and QR codes
 */

import jsPDF from 'jspdf';
import QRCode from 'qrcode';

class ReceiptService {
  /**
   * Generate PDF receipt for a ticket purchase
   * @param {Object} purchase - Purchase data
   * @param {Object} event - Event data
   * @returns {Promise<Blob>} PDF blob
   */
  async generatePDFReceipt(purchase, event) {
    try {
      // Create PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Build receipt data
      const receiptData = this.buildReceiptData(purchase, event);
      
      // Generate QR code as data URL
      const qrCodeDataUrl = await this.generateQRCodeDataUrl(receiptData.qrCode.data);
      
      // Add content to PDF
      await this.addReceiptContent(doc, receiptData, qrCodeDataUrl);
      
      // Return PDF as blob
      return doc.output('blob');
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw new Error('Failed to generate PDF receipt');
    }
  }

  /**
   * Generate QR code as data URL
   * @param {string} data - QR code data
   * @returns {Promise<string>} Data URL
   */
  async generateQRCodeDataUrl(data) {
    try {
      return await QRCode.toDataURL(data, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('QR code generation failed:', error);
      return null;
    }
  }

  /**
   * Add receipt content to PDF document
   * @param {jsPDF} doc - PDF document
   * @param {Object} data - Receipt data
   * @param {string} qrCodeDataUrl - QR code data URL
   */
  async addReceiptContent(doc, data, qrCodeDataUrl) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;

    // Header - MyTabs Branding
    doc.setFillColor(41, 128, 185); // MyTabs blue
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('MyTabs', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(data.company.tagline, pageWidth / 2, 28, { align: 'center' });
    doc.text(data.company.website, pageWidth / 2, 34, { align: 'center' });

    yPos = 50;

    // Receipt Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('TICKET RECEIPT', pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Receipt #: ${data.receipt.number}`, pageWidth / 2, yPos, { align: 'center' });

    yPos += 15;

    // Event Information Section
    this.addSection(doc, 'EVENT INFORMATION', yPos);
    yPos += 10;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Event:`, 20, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(data.event.name, 60, yPos);
    yPos += 6;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Date & Time:`, 20, yPos);
    doc.text(`${data.event.date} at ${data.event.time}`, 60, yPos);
    yPos += 6;
    
    doc.text(`Location:`, 20, yPos);
    doc.text(data.event.location, 60, yPos);
    yPos += 6;
    
    doc.text(`Venue:`, 20, yPos);
    doc.text(data.event.venue, 60, yPos);
    yPos += 12;

    // Customer Information Section
    this.addSection(doc, 'CUSTOMER INFORMATION', yPos);
    yPos += 10;
    
    doc.text(`Name:`, 20, yPos);
    doc.text(data.customer.name, 60, yPos);
    yPos += 6;
    
    doc.text(`Email:`, 20, yPos);
    doc.text(data.customer.email, 60, yPos);
    yPos += 6;
    
    doc.text(`Phone:`, 20, yPos);
    doc.text(data.customer.phone, 60, yPos);
    yPos += 12;

    // Purchase Details Section
    this.addSection(doc, 'PURCHASE DETAILS', yPos);
    yPos += 10;
    
    doc.text(`Tickets:`, 20, yPos);
    doc.text(data.purchase.tickets, 60, yPos);
    yPos += 6;
    
    doc.text(`Quantity:`, 20, yPos);
    doc.text(data.purchase.quantity, 60, yPos);
    yPos += 6;
    
    doc.text(`Unit Price:`, 20, yPos);
    doc.text(`$${data.purchase.unitPrice}`, 60, yPos);
    yPos += 10;
    
    // Payment breakdown
    doc.text(`Subtotal:`, 20, yPos);
    doc.text(`$${data.purchase.subtotal}`, pageWidth - 40, yPos, { align: 'right' });
    yPos += 6;
    
    doc.text(`Service Fee:`, 20, yPos);
    doc.text(`$${data.purchase.serviceFee}`, pageWidth - 40, yPos, { align: 'right' });
    yPos += 6;
    
    doc.text(`Processing Fee:`, 20, yPos);
    doc.text(`$${data.purchase.processingFee}`, pageWidth - 40, yPos, { align: 'right' });
    yPos += 6;
    
    doc.text(`Tax:`, 20, yPos);
    doc.text(`$${data.purchase.tax}`, pageWidth - 40, yPos, { align: 'right' });
    yPos += 8;
    
    // Total line
    doc.setLineWidth(0.5);
    doc.line(20, yPos, pageWidth - 20, yPos);
    yPos += 6;
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`TOTAL:`, 20, yPos);
    doc.text(`$${data.purchase.total}`, pageWidth - 40, yPos, { align: 'right' });
    yPos += 12;

    // Payment Information Section
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    this.addSection(doc, 'PAYMENT INFORMATION', yPos);
    yPos += 10;
    
    doc.text(`Payment Method:`, 20, yPos);
    doc.text(data.receipt.paymentMethod, 60, yPos);
    yPos += 6;
    
    doc.text(`Transaction ID:`, 20, yPos);
    doc.text(data.receipt.transactionId, 60, yPos);
    yPos += 6;
    
    doc.text(`Date Processed:`, 20, yPos);
    doc.text(data.receipt.date, 60, yPos);
    yPos += 6;
    
    doc.text(`Status:`, 20, yPos);
    doc.setTextColor(0, 128, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('PAID', 60, yPos);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    yPos += 12;

    // QR Code Section
    if (qrCodeDataUrl) {
      this.addSection(doc, 'QR CODE FOR EVENT ENTRY', yPos);
      yPos += 10;
      
      // Add QR code image
      const qrSize = 50;
      const qrX = (pageWidth - qrSize) / 2;
      doc.addImage(qrCodeDataUrl, 'PNG', qrX, yPos, qrSize, qrSize);
      yPos += qrSize + 8;
      
      doc.setFontSize(8);
      doc.text(data.qrCode.instructions, pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
    }

    // Important Information Section
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }
    
    this.addSection(doc, 'IMPORTANT INFORMATION', yPos);
    yPos += 8;
    
    doc.setFontSize(9);
    const importantInfo = [
      '• Please arrive 30 minutes before event start time',
      '• Present this receipt or QR code for entry',
      '• No refunds after event date',
      `• For support, contact: ${data.company.support}`,
      '• Keep this receipt for your records'
    ];
    
    importantInfo.forEach(info => {
      doc.text(info, 20, yPos);
      yPos += 5;
    });

    // Footer
    yPos = pageHeight - 30;
    doc.setFillColor(240, 240, 240);
    doc.rect(0, yPos, pageWidth, 30, 'F');
    
    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Thank you for choosing ${data.company.name}!`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;
    doc.text(`Visit ${data.company.website} for more events`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    doc.setFontSize(8);
    doc.text(`Generated: ${data.receipt.date}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
    doc.text(`Receipt #: ${data.receipt.number}`, pageWidth / 2, yPos, { align: 'center' });
  }

  /**
   * Add section header to PDF
   * @param {jsPDF} doc - PDF document
   * @param {string} title - Section title
   * @param {number} yPos - Y position
   */
  addSection(doc, title, yPos) {
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(240, 240, 240);
    doc.rect(15, yPos - 4, pageWidth - 30, 8, 'F');
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(title, 20, yPos + 2);
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