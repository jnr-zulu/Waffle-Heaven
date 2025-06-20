// orders.js - API routes for order management
const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const db = require('../config/database');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// @route   POST api/orders
// @desc    Create a new order
// @access  Private (requires user authentication)
router.post('/', [
  auth,
  // Validation for order creation
  body('items').isArray({ min: 1 }).withMessage('Order must contain at least one item'),
  body('items.*.productId').isInt().withMessage('Valid product ID required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('deliveryAddress').optional(),
  body('pickupTime').optional().isISO8601().withMessage('Valid pickup time required'),
  body('paymentMethod').isIn(['cash', 'card', 'online']).withMessage('Valid payment method required'),
  body('specialInstructions').optional().isString(),
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { items, deliveryAddress, pickupTime, paymentMethod, specialInstructions } = req.body;
  const userId = req.user.id;

  try {
    // Start a transaction
    await db.beginTransaction();

    // 1. Create the order record
    const [orderResult] = await db.query(
      `INSERT INTO orders (user_id, status, delivery_address, pickup_time, 
       payment_method, special_instructions, created_at) 
       VALUES (?, 'pending', ?, ?, ?, ?, NOW())`,
      [userId, deliveryAddress || null, pickupTime || null, paymentMethod, specialInstructions || '']
    );

    const orderId = orderResult.insertId;

    // 2. Add order items and calculate total
    let orderTotal = 0;
    
    for (const item of items) {
      // Get product details
      const [products] = await db.query(
        'SELECT price FROM products WHERE id = ?',
        [item.productId]
      );
      
      if (products.length === 0) {
        await db.rollback();
        return res.status(404).json({ msg: `Product with ID ${item.productId} not found` });
      }
      
      const product = products[0];
      const itemTotal = product.price * item.quantity;
      orderTotal += itemTotal;
      
      // Add to order_items table
      await db.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price_per_unit, item_total) 
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.productId, item.quantity, product.price, itemTotal]
      );
    }
    
    // 3. Update order with total amount
    await db.query(
      'UPDATE orders SET total_amount = ? WHERE id = ?',
      [orderTotal, orderId]
    );
    
    // Commit the transaction
    await db.commit();
    
    // 4. Return success with order details
    res.status(201).json({
      success: true,
      msg: 'Order created successfully',
      order: {
        id: orderId,
        totalAmount: orderTotal,
        status: 'pending',
        createdAt: new Date()
      }
    });
    
  } catch (err) {
    // Rollback in case of error
    await db.rollback();
    console.error('Order creation error:', err.message);
    res.status(500).json({ msg: 'Server error creating order' });
  }
});

// @route   GET api/orders/:id
// @desc    Get order by ID
// @access  Private (limited to order owner or admin)
router.get('/:id', [
  auth,
  param('id').isInt().withMessage('Valid order ID required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const orderId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    // Get order with user check (unless admin)
    const [orders] = await db.query(
      `SELECT o.*, u.email, u.first_name, u.last_name, u.phone
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.id = ? ${isAdmin ? '' : 'AND o.user_id = ?'}`,
      isAdmin ? [orderId] : [orderId, userId]
    );
    
    if (orders.length === 0) {
      return res.status(404).json({ msg: 'Order not found or access denied' });
    }
    
    const order = orders[0];
    
    // Get order items
    const [items] = await db.query(
      `SELECT oi.*, p.name, p.description, p.image_url
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [orderId]
    );
    
    // Return the complete order with items
    res.json({
      ...order,
      items
    });
    
  } catch (err) {
    console.error('Get order error:', err.message);
    res.status(500).json({ msg: 'Server error retrieving order' });
  }
});

// @route   GET api/orders
// @desc    Get all orders for a user or all orders (admin)
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    // Query parameters for filtering
    const { status, startDate, endDate, limit = 20, page = 1 } = req.query;
    const offset = (page - 1) * limit;
    
    // Build query conditionally
    let query = `SELECT o.*, u.email, u.first_name, u.last_name 
                 FROM orders o 
                 JOIN users u ON o.user_id = u.id 
                 WHERE 1=1`;
    const queryParams = [];
    
    // Add filters
    if (!isAdmin) {
      query += ' AND o.user_id = ?';
      queryParams.push(userId);
    }
    
    if (status) {
      query += ' AND o.status = ?';
      queryParams.push(status);
    }
    
    if (startDate) {
      query += ' AND o.created_at >= ?';
      queryParams.push(startDate);
    }
    
    if (endDate) {
      query += ' AND o.created_at <= ?';
      queryParams.push(endDate);
    }
    
    // Add sorting and pagination
    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));
    
    // Execute query
    const [orders] = await db.query(query, queryParams);
    
    // Get count of total orders matching filter (for pagination)
    let countQuery = `SELECT COUNT(*) as total 
                      FROM orders o 
                      WHERE 1=1`;
    const countParams = [];
    
    if (!isAdmin) {
      countQuery += ' AND o.user_id = ?';
      countParams.push(userId);
    }
    
    if (status) {
      countQuery += ' AND o.status = ?';
      countParams.push(status);
    }
    
    if (startDate) {
      countQuery += ' AND o.created_at >= ?';
      countParams.push(startDate);
    }
    
    if (endDate) {
      countQuery += ' AND o.created_at <= ?';
      countParams.push(endDate);
    }
    
    const [countResult] = await db.query(countQuery, countParams);
    const totalOrders = countResult[0].total;
    
    res.json({
      orders,
      pagination: {
        total: totalOrders,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalOrders / limit)
      }
    });
    
  } catch (err) {
    console.error('Get orders error:', err.message);
    res.status(500).json({ msg: 'Server error retrieving orders' });
  }
});

// @route   PATCH api/orders/:id
// @desc    Update order status
// @access  Private (admin only for some operations)
router.patch('/:id', [
  auth,
  param('id').isInt().withMessage('Valid order ID required'),
  body('status').optional().isIn(['pending', 'preparing', 'ready', 'completed', 'cancelled']),
  body('paymentStatus').optional().isIn(['pending', 'paid', 'failed', 'refunded']),
  body('deliveryAddress').optional().isString(),
  body('pickupTime').optional().isISO8601(),
  body('specialInstructions').optional().isString(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const orderId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    // First, check if order exists and belongs to user (unless admin)
    const [orders] = await db.query(
      `SELECT * FROM orders WHERE id = ? ${!isAdmin ? 'AND user_id = ?' : ''}`,
      !isAdmin ? [orderId, userId] : [orderId]
    );
    
    if (orders.length === 0) {
      return res.status(404).json({ msg: 'Order not found or access denied' });
    }
    
    const order = orders[0];
    
    // Determine which fields can be updated based on user role and order status
    const updateFields = [];
    const updateParams = [];
    
    // Status updates - only admin can change most statuses
    if (req.body.status) {
      if (isAdmin || 
         (req.body.status === 'cancelled' && order.status === 'pending')) {
        updateFields.push('status = ?');
        updateParams.push(req.body.status);
      } else {
        return res.status(403).json({ msg: 'Not authorized to update order status' });
      }
    }
    
    // Payment status updates - only admin can change
    if (req.body.paymentStatus && isAdmin) {
      updateFields.push('payment_status = ?');
      updateParams.push(req.body.paymentStatus);
    }
    
    // Customer can update these fields only if order is still pending
    if (order.status === 'pending') {
      if (req.body.deliveryAddress !== undefined) {
        updateFields.push('delivery_address = ?');
        updateParams.push(req.body.deliveryAddress);
      }
      
      if (req.body.pickupTime) {
        updateFields.push('pickup_time = ?');
        updateParams.push(req.body.pickupTime);
      }
      
      if (req.body.specialInstructions !== undefined) {
        updateFields.push('special_instructions = ?');
        updateParams.push(req.body.specialInstructions);
      }
    }
    
    // If nothing to update
    if (updateFields.length === 0) {
      return res.status(400).json({ msg: 'No valid fields to update' });
    }
    
    // Add timestamp and order ID to params
    updateFields.push('updated_at = NOW()');
    updateParams.push(orderId);
    
    // Update the order
    await db.query(
      `UPDATE orders SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );
    
    // Get the updated order
    const [updatedOrders] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    
    res.json({
      msg: 'Order updated successfully',
      order: updatedOrders[0]
    });
    
  } catch (err) {
    console.error('Update order error:', err.message);
    res.status(500).json({ msg: 'Server error updating order' });
  }
});

// @route   DELETE api/orders/:id
// @desc    Cancel an order (soft delete)
// @access  Private (limited to order owner for pending orders, or admin)
router.delete('/:id', [
  auth,
  param('id').isInt().withMessage('Valid order ID required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const orderId = req.params.id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    
    // Get the order
    const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    
    if (orders.length === 0) {
      return res.status(404).json({ msg: 'Order not found' });
    }
    
    const order = orders[0];
    
    // Check authorization
    if (!isAdmin && (order.user_id !== userId || order.status !== 'pending')) {
      return res.status(403).json({ 
        msg: 'Not authorized - only pending orders can be cancelled by customers' 
      });
    }
    
    // Soft delete by updating status
    await db.query(
      'UPDATE orders SET status = "cancelled", updated_at = NOW() WHERE id = ?',
      [orderId]
    );
    
    res.json({ msg: 'Order cancelled successfully' });
    
  } catch (err) {
    console.error('Cancel order error:', err.message);
    res.status(500).json({ msg: 'Server error cancelling order' });
  }
});

module.exports = router;