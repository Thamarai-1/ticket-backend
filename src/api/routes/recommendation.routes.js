/**
 * recommendation.routes.js
 * Express routes for Resolution Recommendations and Evidence Extraction.
 */

const express = require('express');
const router = express.Router();
const recommendationController = require('../../controllers/recommendation.controller');

router.post('/', recommendationController.getRecommendation);
router.post('/recommend', recommendationController.getRecommendation);

module.exports = router;
