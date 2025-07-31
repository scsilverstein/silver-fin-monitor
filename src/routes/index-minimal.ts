// Minimal API routes for stock screener functionality
import { Router } from 'express';
import stockScreenerRoutes from './stock-screener.routes';

const router = Router();

// Health check endpoint (no auth required)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date(),
      service: 'silver-fin-monitor'
    }
  });
});

// Test endpoint
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Test endpoint working',
    timestamp: new Date()
  });
});

// Debug endpoint to check routes
router.get('/debug/routes', (req, res) => {
  const routes: any[] = [];
  router.stack.forEach((layer: any) => {
    if (layer.route) {
      routes.push({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods)
      });
    } else if (layer.name === 'router' && layer.regexp) {
      routes.push({
        path: layer.regexp.toString(),
        type: 'router'
      });
    }
  });
  res.json({
    success: true,
    routes,
    stockScreenerRoutes: stockScreenerRoutes ? 'loaded' : 'not loaded'
  });
});

// Stock screener routes (using actual controller)
router.use('/stocks', stockScreenerRoutes);

// Export versioned API routes
export const apiV1 = router;