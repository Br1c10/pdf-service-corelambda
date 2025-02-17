import express from 'express';
import chromium from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

const getPuppeteerOptions = async () => {
    if (process.env.NODE_ENV !== 'production') {
        return {
            headless: 'new',
            args: ['--no-sandbox'],
            // Aquí necesitamos especificar la ruta a Chrome en tu sistema
            executablePath: 
                process.platform === 'win32'
                    ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'  // Windows
                    : process.platform === 'linux'
                    ? '/usr/bin/google-chrome'                                      // Linux
                    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' // MacOS
        };
    }
    return {
        args: chromium.args,
        executablePath: await chromium.executablePath,
        headless: chromium.headless,
        defaultViewport: chromium.defaultViewport,
    };
};

app.post('/api/generate-pdf', async (req, res) => {
    try {
        const { name, date } = req.body;

        const templatePath = path.join(__dirname, 'templates', 'report.html');
        let html = await fs.promises.readFile(templatePath, 'utf8');
        
        html = html.replace('{{name}}', name).replace('{{date}}', date);
        
        const options = await getPuppeteerOptions();
        const browser = await puppeteer.launch(options);
        
        const page = await browser.newPage();
        await page.setContent(html, { 
            waitUntil: 'networkidle0',
            timeout: 30000
        });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });
        
        await browser.close();
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=report.pdf');
        res.setHeader('Cache-Control', 'no-cache');
        
        return res.end(pdfBuffer);
        
    } catch (error) {
        console.error('Error detallado:', error);
        return res.status(500).json({ 
            error: 'Error generando el PDF',
            details: error.message 
        });
    }
});

// Solo para desarrollo
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
}

export default app;