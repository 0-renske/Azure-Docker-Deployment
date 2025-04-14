const express = require('express');
const next = require('next');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = process.env.PORT || 80;

app.prepare().then(() => {
  const server = express();

  // Serve static files from the "public" folder
  server.use(express.static(path.join(__dirname, 'public')));

  // Handle all other requests with Next.js's request handler
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`Server is running on port ${port}`);
  });
});
