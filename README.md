# Invoice PDF Annotation and Fill Application

A professional full-stack digital PDF annotation and filling tool built using React, Express, PostgreSQL, and TypeScript.

## Main Concept

This application is **not** a true PDF text editor; rather, it is a PDF overlay annotation system. 
- Original text is **locked** and cannot be edited, moved, or deleted.
- The system automatically detects protected text regions (bounding boxes extracted using PDF.js).
- Users can place annotations (Text, Notes, Signatures, Stamps, Checkboxes) only in blank whitespace spaces.
- Overlaps are blocked dynamically, with warnings shown in real-time.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [PostgreSQL](https://www.postgresql.org/) (Running locally)

### Database Configuration
1. Open your PostgreSQL console and create a database:
   ```sql
   CREATE DATABASE invoice_annotation;
   ```
2. Check `backend/.env` and update the `DATABASE_URL` if needed:
   ```env
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/invoice_annotation?schema=public"
   ```

### Installation
Run the following commands from the root directory:
```bash
# Install root, backend, and frontend dependencies
npm run install:all

# Generate Prisma Client & Run Database Push / Migrations
npm run prisma:generate
npm run prisma:migrate
```

### Running Locally
To launch both frontend (Vite) and backend (Express) concurrently:
```bash
npm run dev
```
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

---

## Features
- **Whitespace Protection**: Automatic bounding box extraction for text blocks, preventing user overlap on existing text.
- **Rules-Based Section Recognition**: Suggests annotation regions near common fields (e.g. signature blocks, notes).
- **Interactive Annotation Tools**: Drag to place checkboxes, signatures, stamps, date selectors, and multiline text.
- **High-Fidelity PDF Export**: Re-compiles overlay annotations directly onto the vector document using `pdf-lib` without rasterization.
- **Interactive History**: Maintains project drafts and export histories.
