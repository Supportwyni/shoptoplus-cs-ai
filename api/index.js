// Vercel Serverless Function Entry Point
const path = require('path');

// Point to the built Express app
const app = require(path.join(__dirname, '../dist/index.js')).default;

// Export for Vercel
module.exports = app;

