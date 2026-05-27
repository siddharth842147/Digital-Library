require('dotenv').config();

async function checkModels() {
    console.log("Checking available Gemini models...");
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.log("No API Key found in .env");
            return;
        }

        const fetch = (await import('node-fetch')).default || global.fetch;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await res.json();
        
        if (data.models) {
            console.log("\n✅ AVAILABLE MODELS:");
            data.models.forEach(m => {
                if (m.name.includes('gemini') && m.supportedGenerationMethods.includes('generateContent')) {
                    console.log("- " + m.name.replace('models/', ''));
                }
            });
            console.log("\nIf you see a model like 'gemini-2.0-flash' or 'gemini-3.5-flash', we need to use that name!");
        } else {
            console.error("\n❌ ERROR FETCHING MODELS:", data);
        }
    } catch (e) {
        console.error("Fetch Error:", e.message);
    }
}

checkModels();
