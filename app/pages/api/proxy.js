import { createProxyMiddleware } from 'http-proxy-middleware';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default (req, res) => {
  const { target } = req.query;

  if (!target) {
    return res.status(400).json({ error: 'Target URL is required' });
  }

  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: {
      '^/api/proxy': '',
    },
  })(req, res);
};
