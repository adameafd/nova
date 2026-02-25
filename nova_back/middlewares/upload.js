const multer = require("multer");
const path   = require("path");
const fs     = require("fs");
const sharp  = require("sharp");

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

// Extensions autorisees
const ALLOWED_EXTENSIONS = [
  ".pdf", ".xls", ".xlsx", ".csv", ".doc", ".docx",
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
];

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Type de fichier non autorise : ${ext}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 Mo max
  },
});

// ── Middleware de compression des images après upload ────────────────────────
// Redimensionne à max 800x800 px et compresse en JPEG qualité 80.
// Les fichiers non-image (PDF, etc.) ne sont pas touchés.

async function compressImage(req, res, next) {
  if (!req.file) return next();

  const ext = path.extname(req.file.originalname).toLowerCase();
  if (!IMAGE_EXTENSIONS.includes(ext)) return next();

  const filePath = req.file.path;
  const tmpPath  = filePath + ".tmp.jpg";

  try {
    await sharp(filePath)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(tmpPath);

    // Remplacer l'original par la version compressée
    fs.renameSync(tmpPath, filePath);

    // Mettre à jour le nom de fichier avec extension .jpg
    const newFilename = path.basename(filePath, ext) + ".jpg";
    const newPath     = path.join(uploadsDir, newFilename);
    fs.renameSync(filePath, newPath);

    req.file.path     = newPath;
    req.file.filename = newFilename;

    const sizeBefore = req.file.size;
    const sizeAfter  = fs.statSync(newPath).size;
    console.log(`[upload] Image compressée : ${sizeBefore} → ${sizeAfter} octets (${Math.round((1 - sizeAfter / sizeBefore) * 100)}% gain)`);

  } catch (err) {
    console.error("[upload] Erreur compression sharp :", err.message);
    // En cas d'erreur, on garde le fichier original sans compression
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }

  next();
}

module.exports = upload;
module.exports.compressImage = compressImage;
