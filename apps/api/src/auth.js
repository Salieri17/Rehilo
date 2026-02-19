const DEFAULT_USER = "admin";
const DEFAULT_PASS = "rehilo";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Basic ")) {
    res.set("WWW-Authenticate", "Basic realm=\"Rehilo Sync\"");
    res.status(401).json({ message: "Missing Authorization header" });
    return;
  }

  const credentials = Buffer.from(header.slice(6), "base64").toString("utf8");
  const [user, pass] = credentials.split(":");

  const expectedUser = process.env.REHILO_USER ?? DEFAULT_USER;
  const expectedPass = process.env.REHILO_PASS ?? DEFAULT_PASS;

  if (user !== expectedUser || pass !== expectedPass) {
    res.status(403).json({ message: "Invalid credentials" });
    return;
  }

  next();
}
