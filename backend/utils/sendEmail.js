const tls = require('tls');
const fs = require('fs');
const path = require('path');

// Custom native TLS SMTP Client to avoid dependencies/install issues
const sendSmtpEmail = ({ host, port, user, pass, from, to, subject, message, html, attachments }) => {
    return new Promise((resolve, reject) => {
        const socket = tls.connect({
            host: host,
            port: port,
            rejectUnauthorized: false
        });

        let step = 0;
        let responseBuffer = '';

        const send = (data) => {
            socket.write(data + '\r\n');
        };

        socket.on('data', (chunk) => {
            responseBuffer += chunk.toString();
            while (responseBuffer.includes('\r\n')) {
                const lineIndex = responseBuffer.indexOf('\r\n');
                const line = responseBuffer.substring(0, lineIndex);
                responseBuffer = responseBuffer.substring(lineIndex + 2);

                const code = line.substring(0, 3);
                if (line[3] === '-') continue; // Multi-line response

                if (step === 0 && code === '220') {
                    send('EHLO localhost');
                    step = 1;
                } else if (step === 1 && code === '250') {
                    send('AUTH LOGIN');
                    step = 2;
                } else if (step === 2 && code === '334') {
                    send(Buffer.from(user).toString('base64'));
                    step = 3;
                } else if (step === 3 && code === '334') {
                    send(Buffer.from(pass).toString('base64'));
                    step = 4;
                } else if (step === 4 && code === '235') {
                    send(`MAIL FROM:<${from.includes('<') ? from.split('<')[1].replace('>', '').trim() : from}>`);
                    step = 5;
                } else if (step === 5 && code === '250') {
                    const recipientList = to.split(',').map(r => r.trim());
                    send(`RCPT TO:<${recipientList[0]}>`);
                    socket.recipients = recipientList;
                    socket.recipientIndex = 0;
                    step = 6;
                } else if (step === 6 && code === '250') {
                    socket.recipientIndex++;
                    if (socket.recipientIndex < socket.recipients.length) {
                        send(`RCPT TO:<${socket.recipients[socket.recipientIndex]}>`);
                    } else {
                        send('DATA');
                        step = 7;
                    }
                } else if (step === 7 && code === '354') {
                    const boundary = '----=_Part_' + Math.random().toString(36).substring(2);
                    const emailData = [];
                    
                    emailData.push(`From: ${from}`);
                    emailData.push(`To: ${to}`);
                    emailData.push(`Subject: ${subject}`);
                    emailData.push('MIME-Version: 1.0');
                    
                    if (attachments && attachments.length > 0) {
                        emailData.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
                        emailData.push('');
                        emailData.push(`--${boundary}`);
                        
                        if (html || message) {
                            const isHtml = !!html;
                            emailData.push(`Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`);
                            emailData.push('');
                            emailData.push(html || message);
                            emailData.push('');
                        }
                        
                        for (const att of attachments) {
                            emailData.push(`--${boundary}`);
                            const filename = att.filename || path.basename(att.path || '');
                            emailData.push(`Content-Type: application/octet-stream; name="${filename}"`);
                            emailData.push(`Content-Disposition: attachment; filename="${filename}"`);
                            emailData.push('Content-Transfer-Encoding: base64');
                            emailData.push('');
                            
                            let contentBase64 = '';
                            if (att.content) {
                                contentBase64 = Buffer.from(att.content).toString('base64');
                            } else if (att.path) {
                                try {
                                    if (fs.existsSync(att.path)) {
                                        contentBase64 = fs.readFileSync(att.path).toString('base64');
                                    }
                                } catch (e) {
                                    console.error(`Failed to read attachment ${att.path}:`, e.message);
                                }
                            }
                            const chunks = contentBase64.match(/.{1,76}/g) || [];
                            emailData.push(...chunks);
                            emailData.push('');
                        }
                        emailData.push(`--${boundary}--`);
                    } else {
                        const isHtml = !!html;
                        emailData.push(`Content-Type: ${isHtml ? 'text/html' : 'text/plain'}; charset=utf-8`);
                        emailData.push('');
                        emailData.push(html || message);
                    }
                    
                    emailData.push('.');
                    send(emailData.join('\r\n'));
                    step = 8;
                } else if (step === 8 && code === '250') {
                    send('QUIT');
                    step = 9;
                } else if (step === 9 && code === '221') {
                    socket.end();
                    resolve('Email sent successfully');
                } else if (code.startsWith('4') || code.startsWith('5')) {
                    socket.end();
                    reject(new Error(`SMTP Error: ${line}`));
                }
            }
        });

        socket.on('error', (err) => {
            reject(err);
        });

        socket.on('close', () => {
            if (step < 9) {
                reject(new Error('Connection closed prematurely'));
            }
        });
    });
};

const sendEmail = async (options) => {
    const key = process.env.BREVO_API_KEY;
    const isBrevoApiKey = key && key.startsWith('xkeysib-');
    const isBrevoSmtpKey = key && key.startsWith('xsmtpsib-');
    
    if (isBrevoApiKey) {
        // Send via Brevo API
        const url = 'https://api.brevo.com/v3/smtp/email';
        
        let senderName = 'Library Management';
        let senderEmail = process.env.EMAIL_USER;
        
        const fromStr = options.from || process.env.EMAIL_FROM || process.env.EMAIL_USER;
        if (fromStr && fromStr.includes('<')) {
            const parts = fromStr.split('<');
            senderName = parts[0].trim();
            senderEmail = parts[1].replace('>', '').trim();
        } else if (fromStr) {
            senderEmail = fromStr;
        }

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
            if (senderEmail && senderEmail.endsWith('@gmail.com')) {
                console.warn(`⚠️ Warning: Sending from a Gmail address (${senderEmail}) via Brevo API may fail DMARC check at the recipient's mail server.`);
            }

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
            console.log('Email sent via Brevo API:', data.messageId);
            return data;
        } catch (error) {
            console.error('Email sending failed:', error.message);
            if (options.throwOnError) throw error;
        }
    } else if (isBrevoSmtpKey) {
        // Send via Brevo SMTP Relay
        const fromStr = options.from || process.env.EMAIL_FROM || process.env.EMAIL_USER;
        const html = options.html || (options.message ? options.message.replace(/\n/g, '<br>') : '');
        const smtpUser = process.env.BREVO_SMTP_USER || 'a584d6001@smtp-brevo.com';
        
        try {
            const result = await sendSmtpEmail({
                host: 'smtp-relay.brevo.com',
                port: 465,
                user: smtpUser,
                pass: key,
                from: fromStr,
                to: options.email,
                subject: options.subject,
                message: options.message,
                html: html,
                attachments: options.attachments
            });
            console.log('Email sent via Brevo SMTP:', result);
            return { messageId: 'brevo-smtp-success' };
        } catch (error) {
            console.error('Brevo SMTP Email sending failed:', error.message);
            if (options.throwOnError) throw error;
        }
    } else {
        // Send via Gmail SMTP (using the App password placed in BREVO_API_KEY)
        const fromStr = options.from || process.env.EMAIL_FROM || process.env.EMAIL_USER;
        const html = options.html || (options.message ? options.message.replace(/\n/g, '<br>') : '');
        
        try {
            const result = await sendSmtpEmail({
                host: 'smtp.gmail.com',
                port: 465,
                user: process.env.EMAIL_USER,
                pass: process.env.BREVO_API_KEY, // The Gmail App password
                from: fromStr,
                to: options.email,
                subject: options.subject,
                message: options.message,
                html: html,
                attachments: options.attachments
            });
            console.log('Email sent via Gmail SMTP:', result);
            return { messageId: 'gmail-smtp-success' };
        } catch (error) {
            console.error('Gmail SMTP Email sending failed:', error.message);
            if (options.throwOnError) throw error;
        }
    }
};

module.exports = sendEmail;
