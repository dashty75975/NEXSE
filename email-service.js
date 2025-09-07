// Email Service for NEXŞE Vehicle Tracker
// Handles welcome emails and notifications

class EmailService {
    constructor() {
        this.apiKey = null; // Will be set from environment or config
        this.fromEmail = 'noreply@nexse.iq';
        this.fromName = 'NEXŞE Team';
        this.templateCache = new Map();
        
        // Email service provider - using EmailJS for client-side emails
        this.emailjsServiceId = 'your_emailjs_service_id';
        this.emailjsTemplateId = 'your_emailjs_template_id';
        this.emailjsUserId = 'your_emailjs_user_id';
        
        this.initializeEmailJS();
    }

    async initializeEmailJS() {
        try {
            // Initialize EmailJS
            if (typeof emailjs !== 'undefined') {
                emailjs.init(this.emailjsUserId);
                console.log('EmailJS initialized successfully');
            } else {
                console.warn('EmailJS library not loaded. Email functionality will be limited.');
            }
        } catch (error) {
            console.error('Failed to initialize EmailJS:', error);
        }
    }

    // Send welcome email to new driver
    async sendWelcomeEmail(driverData) {
        try {
            const emailTemplate = this.getWelcomeEmailTemplate(driverData);
            
            const emailParams = {
                to_email: driverData.email,
                to_name: driverData.name,
                from_name: this.fromName,
                subject: 'Welcome to NEXŞE - Registration Received!',
                message: emailTemplate.html,
                reply_to: 'support@nexse.iq'
            };

            // For demo purposes, we'll use a fallback email method
            if (typeof emailjs !== 'undefined' && emailjs.send) {
                const result = await emailjs.send(
                    this.emailjsServiceId,
                    this.emailjsTemplateId,
                    emailParams
                );
                console.log('Welcome email sent successfully:', result);
                return { success: true, messageId: result.text };
            } else {
                // Fallback: Show email content in console and browser
                console.log('Email would be sent to:', driverData.email);
                console.log('Email content:', emailTemplate.html);
                
                // Show email preview in browser
                this.showEmailPreview(emailTemplate.html, driverData.email);
                
                return { success: true, messageId: 'demo_' + Date.now() };
            }
        } catch (error) {
            console.error('Failed to send welcome email:', error);
            return { success: false, error: error.message };
        }
    }

    // Send admin notification for new registration
    async sendAdminNotification(driverData) {
        try {
            const emailTemplate = this.getAdminNotificationTemplate(driverData);
            
            const adminEmails = ['euzardi@gmail.com']; // Admin email from your code
            
            for (const adminEmail of adminEmails) {
                const emailParams = {
                    to_email: adminEmail,
                    to_name: 'Admin',
                    from_name: this.fromName,
                    subject: 'New Driver Registration - Approval Required',
                    message: emailTemplate.html,
                    reply_to: 'noreply@nexse.iq'
                };

                // For demo purposes, log to console
                console.log('Admin notification would be sent to:', adminEmail);
                console.log('Notification content:', emailTemplate.html);
            }

            return { success: true, messageId: 'admin_notification_' + Date.now() };
        } catch (error) {
            console.error('Failed to send admin notification:', error);
            return { success: false, error: error.message };
        }
    }

    // Send approval notification
    async sendApprovalEmail(driverData) {
        try {
            const emailTemplate = this.getApprovalEmailTemplate(driverData);
            
            const emailParams = {
                to_email: driverData.email,
                to_name: driverData.name,
                from_name: this.fromName,
                subject: 'NEXŞE Registration Approved - Welcome!',
                message: emailTemplate.html,
                reply_to: 'support@nexse.iq'
            };

            console.log('Approval email would be sent to:', driverData.email);
            console.log('Email content:', emailTemplate.html);
            
            this.showEmailPreview(emailTemplate.html, driverData.email);
            
            return { success: true, messageId: 'approval_' + Date.now() };
        } catch (error) {
            console.error('Failed to send approval email:', error);
            return { success: false, error: error.message };
        }
    }

    // Get welcome email template
    getWelcomeEmailTemplate(driverData) {
        const template = {
            subject: 'Welcome to NEXŞE - Registration Received!',
            html: `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Welcome to NEXŞE</title>
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; background-color: #f4f4f4; }
                        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
                        .header { background: linear-gradient(135deg, #1e88e5, #43a047); color: white; padding: 30px; text-align: center; }
                        .header h1 { margin: 0; font-size: 28px; }
                        .content { padding: 30px; }
                        .highlight { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
                        .btn { display: inline-block; background: #1e88e5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                        .vehicle-info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🚗 NEXŞE</h1>
                            <p>Iraq's Premier Vehicle Tracking Platform</p>
                        </div>
                        
                        <div class="content">
                            <h2>Welcome ${driverData.name}!</h2>
                            
                            <p>Thank you for registering with NEXŞE, Iraq's leading real-time vehicle tracking platform. We're excited to have you join our growing community of professional drivers.</p>
                            
                            <div class="highlight">
                                <h3>🎉 Registration Received Successfully!</h3>
                                <p>Your registration has been submitted and is currently under review by our team.</p>
                            </div>
                            
                            <div class="vehicle-info">
                                <h3>📋 Registration Details:</h3>
                                <ul>
                                    <li><strong>Name:</strong> ${driverData.name}</li>
                                    <li><strong>Email:</strong> ${driverData.email}</li>
                                    <li><strong>Phone:</strong> ${driverData.phone}</li>
                                    <li><strong>Vehicle Type:</strong> ${this.getVehicleIcon(driverData.vehicleType)} ${driverData.vehicleType}</li>
                                    <li><strong>Vehicle Plate:</strong> ${driverData.plate}</li>
                                    <li><strong>License Number:</strong> ${driverData.licenseNumber}</li>
                                    ${driverData.routeFrom ? `<li><strong>Route:</strong> ${driverData.routeFrom} → ${driverData.routeTo}</li>` : ''}
                                    ${driverData.taxiNumber ? `<li><strong>Taxi Number:</strong> ${driverData.taxiNumber}</li>` : ''}
                                </ul>
                            </div>
                            
                            <h3>⏳ What's Next?</h3>
                            <ol>
                                <li><strong>Review Process:</strong> Our team will review your registration within 24-48 hours</li>
                                <li><strong>Approval Notification:</strong> You'll receive an email once your account is approved</li>
                                <li><strong>Start Driving:</strong> Log in to your driver panel and start accepting rides!</li>
                            </ol>
                            
                            <div class="highlight">
                                <h3>📱 Download Our App</h3>
                                <p>While you wait for approval, download the NEXŞE mobile app for the best driver experience.</p>
                                <a href="#" class="btn">📱 Download for Android</a>
                                <a href="#" class="btn">📱 Download for iOS</a>
                            </div>
                            
                            <h3>💡 Getting Started Tips:</h3>
                            <ul>
                                <li>Ensure your location services are enabled</li>
                                <li>Keep your vehicle information up to date</li>
                                <li>Maintain a professional service for better ratings</li>
                                <li>Follow all traffic laws and regulations</li>
                            </ul>
                            
                            <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                        </div>
                        
                        <div class="footer">
                            <p><strong>NEXŞE Support Team</strong><br>
                            Email: support@nexse.iq<br>
                            Phone: +964 xxx xxx xxx</p>
                            <p>© 2024 NEXŞE. All rights reserved.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
Welcome to NEXŞE, ${driverData.name}!

Thank you for registering with Iraq's premier vehicle tracking platform.

Registration Details:
- Name: ${driverData.name}
- Vehicle Type: ${driverData.vehicleType}
- Plate: ${driverData.plate}

Your registration is under review and you'll be notified within 24-48 hours.

Best regards,
NEXŞE Team
            `
        };

        return template;
    }

    // Get admin notification template
    getAdminNotificationTemplate(driverData) {
        return {
            subject: 'New Driver Registration - Approval Required',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2>🚨 New Driver Registration</h2>
                    <p>A new driver has registered and requires approval:</p>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <h3>Driver Information:</h3>
                        <ul>
                            <li><strong>Name:</strong> ${driverData.name}</li>
                            <li><strong>Email:</strong> ${driverData.email}</li>
                            <li><strong>Phone:</strong> ${driverData.phone}</li>
                            <li><strong>Vehicle Type:</strong> ${driverData.vehicleType}</li>
                            <li><strong>Plate:</strong> ${driverData.plate}</li>
                            <li><strong>License:</strong> ${driverData.licenseNumber}</li>
                            <li><strong>Registration Time:</strong> ${new Date().toLocaleString()}</li>
                        </ul>
                    </div>
                    
                    <p>Please log in to the admin panel to review and approve this registration.</p>
                    
                    <p>Best regards,<br>NEXŞE System</p>
                </div>
            `
        };
    }

    // Get approval email template
    getApprovalEmailTemplate(driverData) {
        return {
            subject: 'NEXŞE Registration Approved - Welcome!',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2>🎉 Congratulations ${driverData.name}!</h2>
                    <p>Your NEXŞE driver registration has been approved!</p>
                    
                    <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <h3>✅ Account Approved</h3>
                        <p>You can now log in to your driver panel and start accepting rides.</p>
                    </div>
                    
                    <h3>🚀 Ready to Start?</h3>
                    <ol>
                        <li>Log in to your driver panel</li>
                        <li>Update your online status</li>
                        <li>Start accepting rides!</li>
                    </ol>
                    
                    <p>Welcome to the NEXŞE family!</p>
                    
                    <p>Best regards,<br>NEXŞE Team</p>
                </div>
            `
        };
    }

    // Get vehicle icon for email
    getVehicleIcon(vehicleType) {
        const icons = {
            taxi: '🚕',
            minibus: '🚐',
            'tuk-tuk': '🛺',
            van: '🚐',
            bus: '🚌'
        };
        return icons[vehicleType] || '🚗';
    }

    // Show email preview in browser (for demo purposes)
    showEmailPreview(htmlContent, recipientEmail) {
        // Create a modal to show email preview
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            max-width: 80%;
            max-height: 80%;
            overflow: auto;
            border-radius: 10px;
            position: relative;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            background: #1e88e5;
            color: white;
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <h3>📧 Email Preview - Sent to: ${recipientEmail}</h3>
            <button onclick="this.closest('.email-modal').remove()" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">✕</button>
        `;

        const body = document.createElement('div');
        body.innerHTML = htmlContent;

        content.appendChild(header);
        content.appendChild(body);
        modal.appendChild(content);
        modal.className = 'email-modal';

        document.body.appendChild(modal);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 10000);
    }

    // Configure email service (for production use)
    configure(config) {
        this.emailjsServiceId = config.serviceId || this.emailjsServiceId;
        this.emailjsTemplateId = config.templateId || this.emailjsTemplateId;
        this.emailjsUserId = config.userId || this.emailjsUserId;
        this.fromEmail = config.fromEmail || this.fromEmail;
        this.fromName = config.fromName || this.fromName;
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.EmailService = EmailService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmailService;
}