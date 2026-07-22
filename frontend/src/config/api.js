if (!process.env.REACT_APP_API_URL) {
    console.warn('Warning: REACT_APP_API_URL environment variable is missing. Defaulting to http://localhost:5000/api');
}

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
