const router = require('express').Router();
const { getSummary, getTopAds, getCategoryBreakdown, getImpressionsTimeSeries } = require('../services/analyticsService');

// GET /analytics/summary — full analytics summary (cached)
router.get('/summary', async (req, res, next) => {
  try {
    const summary = await getSummary();
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /analytics/top-ads
router.get('/top-ads', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const ads = await getTopAds(limit);
    res.json({ ads });
  } catch (err) {
    next(err);
  }
});

// GET /analytics/categories
router.get('/categories', async (req, res, next) => {
  try {
    const breakdown = await getCategoryBreakdown();
    res.json({ categories: breakdown });
  } catch (err) {
    next(err);
  }
});

// GET /analytics/timeseries
router.get('/timeseries', async (req, res, next) => {
  try {
    const hours = Math.min(parseInt(req.query.hours) || 24, 168);
    const data = await getImpressionsTimeSeries(hours);
    res.json({ timeseries: data, hours });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
