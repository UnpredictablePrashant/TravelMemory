import axios from "axios";
import { baseUrl } from "./url";

export const api = axios.create({
  baseURL: baseUrl,
  timeout: 20000,
});

export const MAX_IMAGE_MB = 5;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

// Turns an axios error into a message that is safe and useful to show to the user
export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  if (axios.isCancel(error)) return null;
  if (error.code === "ECONNABORTED") return "The server took too long to respond. Please try again.";
  if (!error.response) return "Cannot reach the server. Check your connection and try again.";
  return error.response.data?.error || fallback;
}

// Uploaded images are stored as "/uploads/<file>" on the backend; external links are used as-is
export function resolveImageUrl(image) {
  if (!image) return null;
  if (image.startsWith("/uploads/")) return `${baseUrl.replace(/\/$/, "")}${image}`;
  if (/^https?:\/\//i.test(image)) return image;
  return null;
}
