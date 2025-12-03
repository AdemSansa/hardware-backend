const dotenv = require("dotenv");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { connectDB } = require("./config/db.js");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const { PDFDocument, StandardFonts } = require("pdf-lib");

dotenv.config();
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:4200", "capacitor://localhost", "http://localhost", "https://localhost", "http://192.168.100.53:5000"],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Make io available globally for use in other modules
global.io = io;

// CORS configuration - allow web and Capacitor native apps
const allowedOrigins = [
  "http://localhost:4200",
  "capacitor://localhost",
  "http://localhost",
  "https://localhost", // Android app uses https://localhost
  /^http:\/\/192\.168\.\d+\.\d+:\d+$/, // Allow local network IPs
  /^https:\/\/192\.168\.\d+\.\d+:\d+$/ // Allow HTTPS local network IPs
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed patterns
    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') {
        return origin === allowed;
      } else if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for development - tighten in production
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Preflight (Express 5 safe)
// SAFE preflight handler for Express 5
app.options(/.*/, cors());

connectDB().then(() => {
  seedProducts();
});

const PORT = process.env.PORT || 5000;

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use(limiter);
// Configure helmet to not interfere with CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// ROUTES
const userRoutes = require("./modules/user/user.route.js");
const authRoutes = require("./modules/Authentification/auth.routes.js");
const productRoutes = require("./modules/product/product.route.js");
const { seedProducts } = require("./modules/product/product.seed");

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/products", productRoutes);
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

app.get("/api/v1/invoices/blank", async (req, res) => {
  try {
    const start = parseInt(req.query.start, 10);
    const end = parseInt(req.query.end, 10);

    if (isNaN(start) || isNaN(end) || end < start) {
      return res.status(400).send("Invalid start/end range");
    }

    const templatePath = path.join(__dirname, "facture_template.pdf");
    const templateBytes = fs.readFileSync(templatePath);

    // Final PDF that will contain all invoices
    const finalPdf = await PDFDocument.create();

    for (let num = start; num <= end; num++) {
      const invoiceNumber = `N° ${num}`;

      // Load template for each invoice
      const pdfDoc = await PDFDocument.load(templateBytes);
      const [page] = await finalPdf.copyPages(pdfDoc, [0]);
      const embeddedPage = finalPdf.addPage(page);

      embeddedPage.drawText(invoiceNumber, {
        x: 440,
        y: 740,
        size: 12,
      });
    }

    const pdfBytes = await finalPdf.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="factures-${start}-to-${end}.pdf"`
    );

    res.send(pdfBytes);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating invoices.");
  }
});
// Periodic task to check and update online status
const { checkAndUpdateOnlineStatus } = require('./services/statusTracker');
setInterval(() => {
  checkAndUpdateOnlineStatus();
}, 5 * 60 * 1000); // Check every 5 minutes

// Socket.io connection handling
io.on('connection', (socket) => {
  

  socket.on('disconnect', () => {
    
  });
});

// START SERVER
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
