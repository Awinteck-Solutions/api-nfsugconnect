import { NextFunction, Request, Response } from "express";
import * as path from "path";
import * as fs from "fs";
const multer = require("multer");

export const uploadRoot = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "uploads");
const imageDir = path.join(uploadRoot, "images");
const fileDir = path.join(uploadRoot, "files");
fs.mkdirSync(imageDir, { recursive: true });
fs.mkdirSync(fileDir, { recursive: true });
const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/avif"];

const documentTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "video/mp4",
  "video/webm",
];

function safeName(file) {
  const base = path.basename(file.originalname, path.extname(file.originalname))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "file";
  return `${base}-${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname).toLowerCase()}`;
}

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(fileDir, { recursive: true });
    cb(null, fileDir);
  },
  filename: (req, file, cb) => cb(null, safeName(file)),
});

const documentUpload = multer({
  storage: fileStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (documentTypes.includes(file.mimetype) || allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Upload a PDF, Word, Excel, PowerPoint, text, ZIP, image, or MP4 file"));
  },
}).single("file");

export function receiveFile(req: Request, res: Response, next: NextFunction) {
  documentUpload(req, res, (error) => {
    if (!error) return next();
    const message = error.code === "LIMIT_FILE_SIZE" ? "Files must be 25 MB or smaller" : error.message || "Upload failed";
    res.status(400).json({ status: false, message });
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(imageDir, { recursive: true });
    cb(null, imageDir);
  },
  filename: (req, file, cb) => {
    const base = path.basename(file.originalname, path.extname(file.originalname))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "image";
    cb(null, `${base}-${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPG, PNG, WEBP, GIF, AVIF, or SVG images can be uploaded"));
  },
}).single("image");

export function receiveImage(req: Request, res: Response, next: NextFunction) {
  imageUpload(req, res, (error) => {
    if (!error) return next();
    const message = error.code === "LIMIT_FILE_SIZE" ? "Images must be 5 MB or smaller" : error.message || "Upload failed";
    res.status(400).json({ status: false, message });
  });
}

export class UploadController {
  static image(req: Request, res: Response) {
    const file = req["file"];
    if (!file) {
      res.status(400).json({ status: false, message: "Choose an image to upload" });
      return;
    }
    const url = `${req.protocol}://${req.get("host")}/uploads/images/${file.filename}`;
    res.status(201).json({
      status: true,
      message: "Image uploaded",
      response: { url, filename: file.filename, size: file.size, type: file.mimetype },
    });
  }
  static file(req: Request, res: Response) {
    const file = req["file"];
    if (!file) {
      res.status(400).json({ status: false, message: "Choose a file to upload" });
      return;
    }
    const url = `${req.protocol}://${req.get("host")}/uploads/files/${file.filename}`;
    res.status(201).json({
      status: true,
      message: "File uploaded",
      response: { url, filename: file.filename, name: file.originalname, size: file.size, type: file.mimetype },
    });
  }
}
