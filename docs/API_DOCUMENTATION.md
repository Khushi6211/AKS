# 📘 API Documentation - Arun Karyana Store Backend

Base URL: `https://your-backend-url.onrender.com`

---

## 🔐 Authentication

Currently using simple user_id based authentication stored in localStorage.
- User ID is passed via request body or URL parameters
- Admin routes check User-ID header

**Future Enhancement**: JWT token-based authentication

---

## 📋 API Endpoints

### Health & Status

#### GET `/` or `/health`
Health check endpoint for monitoring

**Response**:
```json
{
  "status": "healthy",
  "service": "Arun Karyana Store Backend",
  "database": "connected",
  "version": "2.0"
}
```

**Status Codes**:
- `200`: Service is healthy
- `500`: Service is unhealthy (database disconnected)

---

### User Management

#### POST `/register`
Register a new user

**Rate Limit**: 5 requests per minute

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "securepass123",
  "confirm_password": "securepass123"
}
```

**Validation Rules**:
- `name`: Required, max 100 characters, sanitized
- `email`: Required, valid email format
- `phone`: Required, valid 10-digit Indian phone number (6-9 start)
- `password`: Required, minimum 8 characters
- `confirm_password`: Must match password

**Success Response** (201):
```json
{
  "success": true,
  "message": "Registration successful!"
}
```

**Error Responses**:
- `400`: Missing or invalid fields
- `409`: User already exists
- `500`: Server error

---

#### POST `/login`
User login

**Rate Limit**: 10 requests per minute

**Request Body**:
```json
{
  "email_phone": "john@example.com",
  "password": "securepass123"
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Login successful!",
  "user_id": "507f1f77bcf86cd799439011",
  "name": "John Doe",
  "role": "customer"
}
```

**Error Responses**:
- `400`: Missing credentials
- `401`: Invalid credentials
- `500`: Server error

---

#### GET `/profile/<user_id>`
Get user profile details

**URL Parameters**:
- `user_id`: MongoDB ObjectId of the user

**Success Response** (200):
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "created_at": "2025-01-15T10:30:00.000Z",
    "role": "customer"
  }
}
```

**Error Responses**:
- `400`: Invalid user ID format
- `404`: User not found
- `500`: Server error

---

#### POST `/profile/update`
Update user profile

**Rate Limit**: 10 requests per minute

**Request Body**:
```json
{
  "user_id": "507f1f77bcf86cd799439011",
  "name": "John Updated",
  "email": "john.new@example.com",
  "phone": "9876543211"
}
```

**Notes**:
- All fields except `user_id` are optional
- Only include fields you want to update

**Success Response** (200):
```json
{
  "success": true,
  "message": "Profile updated successfully."
}
```

**Error Responses**:
- `400`: Missing user_id or invalid email/phone format
- `404`: User not found
- `500`: Server error

---

#### GET `/user_role/<user_id>`
Get user role (customer or admin)

**URL Parameters**:
- `user_id`: MongoDB ObjectId of the user

**Success Response** (200):
```json
{
  "success": true,
  "role": "customer"
}
```

**Error Responses**:
- `400`: Invalid user ID format
- `404`: User not found
- `500`: Server error

---

### Shopping Cart

#### GET `/cart/<user_id>`
Get user's shopping cart

**URL Parameters**:
- `user_id`: User's unique ID

**Success Response** (200):
```json
{
  "success": true,
  "cart": [
    {
      "id": 1,
      "name": "Lux International Soap",
      "price": 83,
      "quantity": 2,
      "image": "https://..."
    },
    {
      "id": 5,
      "name": "Tata Tea Gold (500g)",
      "price": 215,
      "quantity": 1,
      "image": "https://..."
    }
  ]
}
```

**Error Responses**:
- `500`: Server error

**Notes**:
- Returns empty array if cart doesn't exist or is empty

---

#### POST `/cart/update`
Update user's shopping cart

**Rate Limit**: 30 requests per minute

**Request Body**:
```json
{
  "user_id": "507f1f77bcf86cd799439011",
  "items": [
    {
      "id": 1,
      "name": "Lux International Soap",
      "price": 83,
      "quantity": 2,
      "image": "https://..."
    }
  ]
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Cart updated successfully."
}
```

**Error Responses**:
- `400`: Missing required fields
- `500`: Server error

**Notes**:
- Replaces entire cart with provided items
- Pass empty array to clear cart
- Creates cart if doesn't exist (upsert)

---

### Orders

#### POST `/submit-order`
Place a new order

**Rate Limit**: 10 requests per minute

**Request Body**:
```json
{
  "customer": {
    "name": "John Doe",
    "phone": "9876543210",
    "address": "123 Main St, Barara, Haryana 133201"
  },
  "items": [
    {
      "id": 1,
      "name": "Lux International Soap",
      "price": 83,
      "quantity": 2
    }
  ],
  "subtotal": 166,
  "deliveryFee": 40,
  "total": 206,
  "user_id": "507f1f77bcf86cd799439011"
}
```

**Required Fields**:
- `customer.name`: Customer name
- `customer.phone`: Contact number
- `customer.address`: Delivery address
- `items`: Array of order items (must have at least one)
- `total`: Total amount

**Optional Fields**:
- `subtotal`: Subtotal before delivery
- `deliveryFee`: Delivery charge
- `user_id`: For registered users

**Success Response** (201):
```json
{
  "success": true,
  "message": "Order placed successfully!",
  "order_id": "507f1f77bcf86cd799439012"
}
```

**Error Responses**:
- `400`: Missing or invalid fields
- `500`: Server error

---

#### GET `/orders/<user_id>`
Get all orders for a user

**URL Parameters**:
- `user_id`: User's unique ID

**Success Response** (200):
```json
{
  "success": true,
  "orders": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "customer_info": {
        "name": "John Doe",
        "phone": "9876543210",
        "address": "123 Main St, Barara"
      },
      "items": [
        {
          "id": 1,
          "name": "Lux International Soap",
          "price": 83,
          "quantity": 2
        }
      ],
      "subtotal": 166,
      "delivery_fee": 40,
      "total_amount": 206,
      "order_date": "2025-01-15T14:30:00.000Z",
      "status": "Pending",
      "user_id": "507f1f77bcf86cd799439011"
    }
  ]
}
```

**Error Responses**:
- `500`: Server error

**Notes**:
- Orders sorted by date (newest first)
- Returns empty array if no orders found

---

#### GET `/order/<order_id>`
Get details of a specific order

**URL Parameters**:
- `order_id`: MongoDB ObjectId of the order

**Success Response** (200):
```json
{
  "success": true,
  "message": "Order found",
  "order": {
    "_id": "507f1f77bcf86cd799439012",
    "customer_info": {
      "name": "John Doe",
      "phone": "9876543210",
      "address": "123 Main St, Barara"
    },
    "items": [...],
    "subtotal": 166,
    "delivery_fee": 40,
    "total_amount": 206,
    "order_date": "2025-01-15T14:30:00.000Z",
    "status": "Pending",
    "user_id": "507f1f77bcf86cd799439011"
  }
}
```

**Error Responses**:
- `400`: Invalid order ID format
- `404`: Order not found
- `500`: Server error

---

### Admin Endpoints (Protected)

All admin endpoints require `User-ID` header with admin user's ID.

#### GET `/admin/users`
Get all users (admin only)

**Headers**:
```
User-ID: 507f1f77bcf86cd799439011
```

**Success Response** (200):
```json
{
  "success": true,
  "users": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "9876543210",
      "created_at": "2025-01-15T10:30:00.000Z",
      "role": "customer"
    }
  ]
}
```

**Error Responses**:
- `401`: Authentication required (missing User-ID header)
- `403`: Admin access required (user is not admin)
- `500`: Server error

---

#### GET `/admin/orders`
Get all orders (admin only)

**Headers**:
```
User-ID: 507f1f77bcf86cd799439011
```

**Success Response** (200):
```json
{
  "success": true,
  "orders": [...]
}
```

**Error Responses**:
- `401`: Authentication required
- `403`: Admin access required
- `500`: Server error

---

## 🔒 Security Features

### Rate Limiting
- **Default**: 200 requests per day, 50 per hour per IP
- **Registration**: 5 per minute
- **Login**: 10 per minute
- **Cart updates**: 30 per minute
- **Profile updates**: 10 per minute
- **Order submission**: 10 per minute

### Input Validation
- Email format validation (regex)
- Phone number validation (10-digit Indian format)
- Password strength (minimum 8 characters)
- SQL injection prevention
- XSS protection (input sanitization)

### CORS Configuration
- Restricted to specific frontend domain
- Credentials support enabled
- Allowed methods: GET, POST, PUT, DELETE, OPTIONS
- Allowed headers: Content-Type, Authorization, User-ID

### MongoDB Security
- Connection pooling (max 50 connections)
- Indexed collections for performance
- Password hashing with bcrypt
- Parameterized queries (prevents injection)

---

## 📊 Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description here"
}
```

**Common HTTP Status Codes**:
- `200`: Success
- `201`: Created (new resource)
- `400`: Bad Request (invalid input)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `409`: Conflict (duplicate resource)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

---

## 🧪 Testing the API

### Using cURL

**Register a user**:
```bash
curl -X POST https://your-backend.onrender.com/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "9876543210",
    "password": "password123",
    "confirm_password": "password123"
  }'
```

**Login**:
```bash
curl -X POST https://your-backend.onrender.com/login \
  -H "Content-Type: application/json" \
  -d '{
    "email_phone": "test@example.com",
    "password": "password123"
  }'
```

**Get cart**:
```bash
curl https://your-backend.onrender.com/cart/USER_ID_HERE
```

**Update cart**:
```bash
curl -X POST https://your-backend.onrender.com/cart/update \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "USER_ID_HERE",
    "items": [
      {"id": 1, "name": "Lux Soap", "price": 83, "quantity": 2}
    ]
  }'
```

### Using Postman

1. Import collection (create one with these endpoints)
2. Set base URL variable: `{{base_url}}`
3. Test each endpoint
4. Save user_id from login response for other requests

### Using Browser Console

```javascript
// Health check
fetch('https://your-backend.onrender.com/health')
  .then(r => r.json())
  .then(console.log);

// Login
fetch('https://your-backend.onrender.com/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email_phone: 'test@example.com',
    password: 'password123'
  })
})
  .then(r => r.json())
  .then(console.log);
```

---

## 🔄 Future API Improvements

Planned enhancements:

1. **JWT Authentication**
   - Replace simple user_id with JWT tokens
   - Add refresh token mechanism
   - Token expiration handling

2. **Password Reset**
   - Email-based password reset
   - Temporary reset tokens
   - Security questions

3. **Email Notifications**
   - Order confirmation emails
   - Status update notifications
   - Welcome emails

4. **Products API**
   - GET /products - Get all products
   - GET /products/<id> - Get single product
   - POST /products - Add product (admin)
   - PUT /products/<id> - Update product (admin)
   - DELETE /products/<id> - Delete product (admin)

5. **Order Management**
   - PATCH /order/<id>/status - Update order status (admin)
   - GET /order/<id>/tracking - Track order
   - POST /order/<id>/cancel - Cancel order

6. **Analytics**
   - GET /admin/analytics - Sales analytics
   - GET /admin/dashboard - Dashboard stats

7. **Search & Filter**
   - GET /products/search?q=query
   - GET /products?category=food&sort=price

---

## 📝 Notes

- All dates are in ISO 8601 format (UTC)
- MongoDB ObjectIds are 24-character hexadecimal strings
- Prices are in Indian Rupees (INR)
- Phone numbers must be valid 10-digit Indian numbers
- Images are hosted on external service (imgbb.com)

---

**Last Updated**: October 2025  
**API Version**: 2.0

For questions or issues, refer to the main README or deployment guide.
