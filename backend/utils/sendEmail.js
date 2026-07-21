const sendEmail = async (options) => {
    // Brevo API endpoint
    const url = 'https://api.brevo.com/v3/smtp/email';
    
    // Parse the sender details
    let senderName = 'Library Management';
    let senderEmail = process.env.EMAIL_USER;
    
    // Handle 'Name <email@dom.com>' format
    const fromStr = options.from || process.env.EMAIL_FROM || process.env.EMAIL_USER;
    if (fromStr && fromStr.includes('<')) {
        const parts = fromStr.split('<');
        senderName = parts[0].trim();
        senderEmail = parts[1].replace('>', '').trim();
    } else if (fromStr) {
        senderEmail = fromStr;
    }

    // Handle multiple recipient emails (e.g., staffEmails.join(','))
    const toRecipients = options.email.split(',').map(email => ({
        email: email.trim()
    }));

    const payload = {
        sender: {
            name: senderName,
            email: senderEmail
        },
        replyTo: {
            email: senderEmail,
            name: senderName
        },
        to: toRecipients,
        subject: options.subject,
        textContent: options.message,
        htmlContent: options.html || (options.message ? options.message.replace(/\n/g, '<br>') : '')
    };

    if (options.attachments && options.attachments.length > 0) {
        const fs = require('fs');
        payload.attachment = options.attachments.map(att => {
            const mapped = { name: att.filename };
            if (att.content) {
                mapped.content = Buffer.from(att.content).toString('base64');
            } else if (att.path) {
                if (att.path.startsWith('http://') || att.path.startsWith('https://')) {
                    mapped.url = att.path;
                } else {
                    try {
                        if (fs.existsSync(att.path)) {
                            mapped.content = fs.readFileSync(att.path).toString('base64');
                        } else {
                            console.error(`Attachment path does not exist: ${att.path}`);
                        }
                    } catch (readError) {
                        console.error(`Failed to read attachment file at ${att.path}:`, readError.message);
                    }
                }
            }
            return mapped;
        }).filter(att => att.content || att.url);
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': process.env.BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Brevo API Error: ${response.status} - ${errorData}`);
        }

        const data = await response.json();
        console.log('Email sent via Brevo:', data.messageId);
        return data;
    } catch (error) {
        console.error('Email sending failed:', error.message);
        if (options.throwOnError) throw error;
    }
};

module.exports = sendEmail;
