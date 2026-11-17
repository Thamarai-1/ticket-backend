/**
 * search.routes.js
 * Express routes for Text, Hybrid, and Semantic Vector Search.
 */

const express = require('express');
const router = express.Router();
const searchController = require('../../controllers/search.controller');

router.get('/', searchController.search);
router.post('/hybrid', searchController.hybridSearch);
router.post('/semantic', searchController.semanticSearch);

module.exports = router;
