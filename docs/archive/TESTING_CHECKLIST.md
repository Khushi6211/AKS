# Comprehensive Testing Checklist

## 🎯 All Features to Test

### ✅ Bug Fixes (Priority 1)

#### **Bug 1: Products Appearing on Store Website**
- [ ] Admin: Add a new product with all details
- [ ] Admin: Upload product image via Cloudinary
- [ ] Admin: Save product successfully
- [ ] Store: Refresh homepage
- [ ] Store: Verify new product appears in product grid
- [ ] Store: Verify product image loads correctly
- [ ] Store: Verify product price and name display correctly
- [ ] Store: Test "Add to Cart" functionality for new product

#### **Bug 2: Email Field in Checkout**
- [ ] Store: Add products to cart
- [ ] Store: Click "Proceed to Checkout"
- [ ] Store: Verify email field is visible
- [ ] Store: Verify email field is required
- [ ] Store: Test email validation (invalid format should show error)
- [ ] Store: Enter valid email and complete order
- [ ] Store: Check if order confirmation email is received
- [ ] Admin: Verify order shows customer email in order details

#### **Bug 3: Low Stock Alerts**
- [ ] Admin: Add product with stock < 10 (e.g., stock = 5)
- [ ] Admin: Check dashboard "Low Stock" count increases
- [ ] Admin: Verify low stock badge has red color and pulse animation
- [ ] Admin: Go to Products section
- [ ] Admin: Verify low stock product has red banner "LOW STOCK ALERT"
- [ ] Admin: Verify low stock product has red ring border
- [ ] Admin: Verify stock badge shows warning triangle icon
- [ ] Admin: Click "Low Stock Only" filter
- [ ] Admin: Verify only low stock products display
- [ ] Admin: Update product stock to 15
- [ ] Admin: Verify product no longer shows as low stock

#### **Bug 4: Forgot Password System**
- [ ] Login Page: Verify "Forgot Password?" link exists
- [ ] Login Page: Click "Forgot Password?" link
- [ ] Forgot Password Page: Enter registered email
- [ ] Forgot Password Page: Click "Send Reset Link"
- [ ] Forgot Password Page: Verify success message displays
- [ ] Email: Check inbox for password reset email
- [ ] Email: Click reset link in email
- [ ] Reset Password Page: Verify token is valid (no error)
- [ ] Reset Password Page: Enter new password
- [ ] Reset Password Page: Confirm password matches
- [ ] Reset Password Page: Test password strength indicator
- [ ] Reset Password Page: Click "Reset Password"
- [ ] Reset Password Page: Verify success message
- [ ] Login Page: Test login with new password
- [ ] Test: Try using expired token (should show error)
- [ ] Test: Try invalid token format (should show error)

### ✅ New Features (Priority 2)

#### **Feature 1: Mobile-Responsive Admin Dashboard**
- [ ] **Mobile (320px - 375px)**:
  - [ ] Verify hamburger menu button appears
  - [ ] Click hamburger - sidebar slides in from left
  - [ ] Verify mobile overlay appears
  - [ ] Click overlay - sidebar closes
  - [ ] Verify close button (X) works
  - [ ] Stats cards stack vertically (1 column)
  - [ ] All buttons are touch-friendly (44px+ height)
  - [ ] Tables scroll horizontally
  - [ ] Filter buttons stack vertically
  - [ ] Product grid shows 1 column
  - [ ] Forms don't cause iOS zoom (16px font)
- [ ] **Tablet (768px - 1024px)**:
  - [ ] Hamburger menu disappears
  - [ ] Sidebar always visible
  - [ ] Stats show 2 columns
  - [ ] Product grid shows 2 columns
  - [ ] Proper padding and spacing
- [ ] **Desktop (>1024px)**:
  - [ ] Full sidebar visible
  - [ ] Stats show 4 columns
  - [ ] Product grid shows 3-4 columns
  - [ ] All features work properly

#### **Feature 2: Offers/Promotions Management**
- [ ] Admin: Click "Offers" in navigation
- [ ] Admin: Verify offers section loads
- [ ] Admin: Click "Add Offer" button
- [ ] Admin: Fill all required fields (title, description, discount type, value)
- [ ] Admin: Select discount type: Percentage
- [ ] Admin: Enter discount value (e.g., 20)
- [ ] Admin: Add promo code (verify auto-uppercase)
- [ ] Admin: Set minimum purchase amount
- [ ] Admin: Set start and end dates
- [ ] Admin: Leave "Active" checked
- [ ] Admin: Click "Save Offer"
- [ ] Admin: Verify offer appears in grid
- [ ] Admin: Verify offer shows green "Active" badge
- [ ] Admin: Verify discount displays correctly (20% OFF)
- [ ] Admin: Click "Edit" on offer
- [ ] Admin: Update offer details
- [ ] Admin: Save changes
- [ ] Admin: Verify changes reflected
- [ ] Admin: Click "Deactivate" button
- [ ] Admin: Verify offer shows gray "Inactive" badge
- [ ] Admin: Click "Activate" button
- [ ] Admin: Verify offer becomes active again
- [ ] Admin: Create offer with discount type: Fixed Amount
- [ ] Admin: Verify displays as "₹100 OFF"
- [ ] Admin: Click "Delete" on offer
- [ ] Admin: Confirm deletion
- [ ] Admin: Verify offer removed from grid
- [ ] Store: Test public offers endpoint (only active offers visible)

### ✅ Sentry Error Tracking

- [ ] Render: Add `SENTRY_DSN` environment variable
- [ ] Render: Wait for auto-deployment
- [ ] Backend: Visit health endpoint
- [ ] Sentry: Check dashboard for events
- [ ] Backend: Trigger an error (invalid endpoint)
- [ ] Sentry: Verify error captured with stack trace
- [ ] Sentry: Verify request context included
- [ ] Sentry: Set up email alerts (optional)

### ✅ Existing Functionality (Regression Testing)

#### **Authentication**
- [ ] Register new user
- [ ] Login with email
- [ ] Login with phone
- [ ] Logout
- [ ] Admin login with admin credentials
- [ ] Access control (non-admin cannot access admin panel)

#### **Product Management (Admin)**
- [ ] View all products
- [ ] Add product with Cloudinary image
- [ ] Edit product
- [ ] Update product stock
- [ ] Delete product (with Cloudinary cleanup)
- [ ] Filter products (categories)

#### **Order Management (Admin)**
- [ ] View all orders
- [ ] View order details
- [ ] Update order status
- [ ] Verify status update email sent
- [ ] View recent orders on dashboard
- [ ] Check order statistics

#### **Customer Management (Admin)**
- [ ] View customers list
- [ ] View customer statistics
- [ ] Check customer order history

#### **Shopping (Store)**
- [ ] Browse products
- [ ] Filter by category
- [ ] Search products
- [ ] Add to cart
- [ ] Update cart quantities
- [ ] Remove from cart
- [ ] Free delivery calculation (>₹500)
- [ ] Delivery fee calculation (<₹500)
- [ ] Complete checkout
- [ ] Order confirmation

#### **Dashboard Stats (Admin)**
- [ ] Today's sales amount
- [ ] Today's orders count
- [ ] Pending orders count
- [ ] Total products count
- [ ] Low stock count (with pulse animation)
- [ ] Total customers count
- [ ] Recent orders table

### ✅ Cross-Browser Testing

- [ ] **Chrome** (Desktop & Mobile)
- [ ] **Firefox**
- [ ] **Safari** (Desktop & iOS)
- [ ] **Edge**
- [ ] **Mobile browsers** (Chrome, Safari)

### ✅ Performance Testing

- [ ] Page load times < 3 seconds
- [ ] Image loading (Cloudinary CDN)
- [ ] API response times < 500ms
- [ ] Mobile data usage reasonable
- [ ] No memory leaks
- [ ] Smooth animations and transitions

### ✅ Security Testing

- [ ] Rate limiting works (3 forgot password requests/hour)
- [ ] Admin endpoints require authentication
- [ ] SQL injection protection
- [ ] XSS protection (input sanitization)
- [ ] Password hashing (bcrypt)
- [ ] HTTPS enabled
- [ ] CORS configured correctly

### ✅ Email Testing

- [ ] Order confirmation emails
- [ ] Order status update emails
- [ ] Password reset emails
- [ ] Email formatting (HTML + plain text)
- [ ] Email deliverability
- [ ] Check spam folder

---

## 📊 Test Results Template

Create a test report with:

```markdown
## Test Execution: [Date]

### Bug Fixes
- Bug 1 (Products): ✅ PASS / ❌ FAIL - [Notes]
- Bug 2 (Email): ✅ PASS / ❌ FAIL - [Notes]
- Bug 3 (Low Stock): ✅ PASS / ❌ FAIL - [Notes]
- Bug 4 (Forgot Password): ✅ PASS / ❌ FAIL - [Notes]

### New Features
- Feature 1 (Mobile Responsive): ✅ PASS / ❌ FAIL - [Notes]
- Feature 2 (Offers System): ✅ PASS / ❌ FAIL - [Notes]

### Regression Tests
- Authentication: ✅ PASS / ❌ FAIL
- Products: ✅ PASS / ❌ FAIL
- Orders: ✅ PASS / ❌ FAIL
- Shopping: ✅ PASS / ❌ FAIL

### Issues Found
1. [Description] - Severity: High/Medium/Low
2. [Description] - Severity: High/Medium/Low

### Overall Status: ✅ READY / ⚠️ NEEDS FIXES / ❌ BLOCKED
```

---

## 🎯 Priority Order for Testing

1. **Critical (Test First)**:
   - Bug 1: Products appearing
   - Bug 2: Email field
   - Bug 4: Forgot password
   - Authentication & authorization

2. **High Priority**:
   - Bug 3: Low stock alerts
   - Feature 2: Offers system
   - Order management
   - Shopping cart & checkout

3. **Medium Priority**:
   - Feature 1: Mobile responsive
   - Dashboard statistics
   - Email notifications

4. **Low Priority**:
   - Cross-browser testing
   - Performance testing
   - UI/UX polish

---

## ✅ Sign-Off Checklist

Before marking as production-ready:

- [ ] All critical bugs fixed and tested
- [ ] All new features working
- [ ] No regression in existing features
- [ ] Mobile responsiveness verified
- [ ] Emails sending correctly
- [ ] Sentry configured and capturing errors
- [ ] Admin dashboard fully functional
- [ ] Store website fully functional
- [ ] Security measures in place
- [ ] Performance acceptable
- [ ] Documentation complete

---

**Estimated Testing Time**: 4-6 hours for comprehensive testing

**Tester**: Ashish (Store Owner) or designated QA person

**Environment**: 
- Backend: https://arun-karyana-backend.onrender.com
- Frontend: https://arun-karyana.netlify.app
