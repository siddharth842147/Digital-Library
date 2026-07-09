const NodeClam = require('clamscan');
const sharp = require('sharp');
const fs = require('fs');

let clamscan = null;

// Initialize ClamScan
new NodeClam().init({
    removeInfected: true,
    quarantineInfected: false,
    debugMode: false,
    clamdscan: {
        host: '127.0.0.1',
        port: 3310,
        localFallback: true,
    },
    preference: 'clamdscan'
}).then(clam => {
    clamscan = clam;
    console.log('✅ ClamAV initialized for virus scanning.');
}).catch(err => {
    console.log('⚠️ ClamAV initialization failed. Virus scanning will be bypassed in dev mode. Ensure clamd is running in production.');
});

exports.processUpload = async (req, res, next) => {
    if (!req.file) {
        return next();
    }

    const filePath = req.file.path;

    try {
        // 1. Virus Scanning (if ClamAV is running)
        if (clamscan) {
            const { isInfected, viruses } = await clamscan.isInfected(filePath);
            if (isInfected) {
                fs.unlinkSync(filePath);
                return res.status(400).json({ success: false, message: `Malicious file detected! Virus: ${viruses.join(', ')}` });
            }
        }

        // 2. EXIF Metadata Stripping for Images
        const mimeType = req.file.mimetype;
        if (mimeType.startsWith('image/')) {
            const tempPath = `${filePath}.tmp`;
            
            // Re-encode image which inherently strips EXIF metadata using sharp
            await sharp(filePath)
                .withMetadata(false) // explicitly drop metadata
                .toFile(tempPath);
            
            // Replace original with stripped version
            fs.renameSync(tempPath, filePath);
        }

        next();
    } catch (err) {
        // Cleanup on error
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return res.status(500).json({ success: false, message: 'File processing error.', error: err.message });
    }
};
