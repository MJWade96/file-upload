import http from 'http'
import controller from './controller.js';

const server = http.createServer()
server.listen(9999);
server.on("request", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Headers", "*")
  if (req.method === "OPTIONS") {
    res.status = 200
    res.end()
    return
  }
  if (req.url === '/') return controller.handleFormData(req, res);
  if (req.url === '/merge') return controller.handleMerge(req, res);
  if (req.url === '/verify') return controller.handleVerification(req, res);
});