import rateLimit from "express-rate-limit";

// Rate limiter for auth routes to mitigate brute-force and abuse.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many requests, please try again later." });
  },
});
