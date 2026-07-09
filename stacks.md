# Project Technology Stack

This project is built using the **MERN Stack** (MongoDB, Express.js, React.js, Node.js) along with several other modern libraries to support its features. 

Here is a brief overview of the technology stack used:

### 1. Frontend (Client-Side)
*   **Core:** React.js (v18) 
*   **Routing:** React Router v6 for Single Page Application (SPA) navigation.
*   **Styling & UI:** Bootstrap 5 and React-Bootstrap for responsive, pre-built components.
*   **API Communication:** Axios for making HTTP requests to the backend.
*   **Features:**
    *   `qrcode.react` & `html5-qrcode` for rendering and scanning digital student ID QR codes.
    *   `@stripe/react-stripe-js` for handling frontend payment elements.

### 2. Backend (Server-Side)
*   **Core:** Node.js with the Express.js framework to build RESTful APIs.
*   **Database:** MongoDB (NoSQL) using Mongoose (ODM) to structure and interact with the database models (Users, Books, Borrowings, etc.).
*   **Authentication & Security:** 
    *   `jsonwebtoken` (JWT) for secure, role-based user sessions (Student, Librarian, Admin).
    *   `bcryptjs` for hashing passwords.
    *   `helmet` and `express-rate-limit` to protect the API from vulnerabilities and spam.
*   **Features:**
    *   `multer` for handling file uploads (e.g., in the Research Hub).
    *   `razorpay` & `stripe` for processing fine payments securely.
    *   `pdfkit` for generating dynamic reports/receipts.
    *   `csv-parser` for bulk-uploading library books.

In summary, it's a robust React single-page application powered by a secure Node/Express server and a flexible MongoDB database.

---

## Hardware & System Requirements

### 1. Server-Side (Hosting Environment)
These are the requirements if you plan to host the backend and database locally or on a VPS (like AWS EC2, DigitalOcean):
*   **Processor:** Dual-core 2.0 GHz or higher (e.g., Intel Core i3 / AMD equivalent).
*   **RAM:** 4GB minimum (8GB recommended for smooth database operations).
*   **Storage:** 10GB of minimum free space (SSD highly recommended for faster MongoDB queries).
*   **OS:** Linux (Ubuntu/CentOS recommended), Windows Server, or macOS.
*   **Network:** Stable internet connection for external APIs (Google Books, Stripe/Razorpay).

### 2. Client-Side (User Devices)
The platform is accessible via any standard web browser, making the hardware requirements for end-users minimal.
*   **Processor:** Any modern mobile or desktop processor.
*   **RAM:** 2GB minimum (4GB recommended).
*   **Screen Resolution:** 1024x768 or higher (The UI is fully responsive for mobile, tablet, and desktop).
*   **Web Browser:** Any modern updated browser (Google Chrome, Mozilla Firefox, Safari, Microsoft Edge).
*   **Additional Hardware (Librarian Role):** A working webcam or built-in camera is required for the Librarian to scan student QR codes.
