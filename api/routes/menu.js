// menu.js - API routes for menu management
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

/**
 * @route   GET api/menu
 * @desc    Get all menu items
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // Get query parameters for filtering
    const category = req.query.category;
    const featured = req.query.featured;
    
    let query = 'SELECT * FROM menu_items WHERE active = 1';
    const queryParams = [];
    
    // Add filters if provided
    if (category) {
      query += ' AND category = ?';
      queryParams.push(category);
    }
    
    if (featured === 'true') {
      query += ' AND featured = 1';
    }
    
    // Add ordering
    query += ' ORDER BY category, name';
    
    const [items] = await db.query(query, queryParams);
    
    res.json(items);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * @route   GET api/menu/categories
 * @desc    Get all menu categories
 * @access  Public
 */
router.get('/categories', async (req, res) => {
  try {
    const [categories] = await db.query(
      'SELECT DISTINCT category FROM menu_items WHERE active = 1 ORDER BY category'
    );
    
    res.json(categories.map(item => item.category));
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * @route   GET api/menu/:id
 * @desc    Get menu item by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const [items] = await db.query(
      'SELECT * FROM menu_items WHERE id = ? AND active = 1',
      [req.params.id]
    );
    
    if (items.length === 0) {
      return res.status(404).json({ msg: 'Menu item not found' });
    }
    
    res.json(items[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * @route   POST api/menu
 * @desc    Create a new menu item
 * @access  Private/Admin
 */
router.post('/', [
  adminAuth,
  [
    body('name').not().isEmpty().withMessage('Name is required'),
    body('description').not().isEmpty().withMessage('Description is required'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('category').not().isEmpty().withMessage('Category is required'),
    body('image_url').optional().isURL().withMessage('Image URL must be valid')
  ]
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  const { 
    name, 
    description, 
    price, 
    category, 
    image_url, 
    ingredients, 
    featured = false, 
    nutrition_info = {} 
  } = req.body;
  
  try {
    const [result] = await db.query(
      `INSERT INTO menu_items 
       (name, description, price, category, image_url, ingredients, featured, nutrition_info, active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        name, 
        description, 
        price, 
        category, 
        image_url || null, 
        JSON.stringify(ingredients || []), 
        featured ? 1 : 0, 
        JSON.stringify(nutrition_info)
      ]
    );
    
    const [newItem] = await db.query(
      'SELECT * FROM menu_items WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(newItem[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * @route   PUT api/menu/:id
 * @desc    Update a menu item
 * @access  Private/Admin
 */
router.put('/:id', adminAuth, async (req, res) => {
  try {
    // Check if menu item exists
    const [items] = await db.query(
      'SELECT * FROM menu_items WHERE id = ?',
      [req.params.id]
    );
    
    if (items.length === 0) {
      return res.status(404).json({ msg: 'Menu item not found' });
    }
    
    // Build update query dynamically based on provided fields
    const updates = {};
    const allowedFields = [
      'name', 'description', 'price', 'category', 'image_url', 
      'ingredients', 'featured', 'nutrition_info', 'active'
    ];
    
    allowedFields.forEach(field => {
      if (field in req.body) {
        if (field === 'ingredients' || field === 'nutrition_info') {
          updates[field] = JSON.stringify(req.body[field]);
        } else if (field === 'featured') {
          updates[field] = req.body[field] ? 1 : 0;
        } else {
          updates[field] = req.body[field];
        }
      }
    });
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ msg: 'No fields to update' });
    }
    
    // Build SQL query
    const updateFields = Object.keys(updates).map(field => `${field} = ?`).join(', ');
    const query = `UPDATE menu_items SET ${updateFields} WHERE id = ?`;
    
    // Execute update
    await db.query(query, [...Object.values(updates), req.params.id]);
    
    // Get updated item
    const [updatedItems] = await db.query(
      'SELECT * FROM menu_items WHERE id = ?',
      [req.params.id]
    );
    
    res.json(updatedItems[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * @route   DELETE api/menu/:id
 * @desc    Delete a menu item (soft delete by setting active=0)
 * @access  Private/Admin
 */
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    // Check if menu item exists
    const [items] = await db.query(
      'SELECT * FROM menu_items WHERE id = ?',
      [req.params.id]
    );
    
    if (items.length === 0) {
      return res.status(404).json({ msg: 'Menu item not found' });
    }
    
    // Soft delete - set active = 0
    await db.query(
      'UPDATE menu_items SET active = 0 WHERE id = ?',
      [req.params.id]
    );
    
    res.json({ msg: 'Menu item removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

/**
 * @route   GET api/menu/featured
 * @desc    Get featured menu items
 * @access  Public
 */
router.get('/featured/items', async (req, res) => {
  try {
    const [items] = await db.query(
      'SELECT * FROM menu_items WHERE featured = 1 AND active = 1 ORDER BY category, name'
    );
    
    res.json(items);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;