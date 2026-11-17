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
router.post('/chunks/inspect', searchController.inspectChunks);

module.exports = router;
