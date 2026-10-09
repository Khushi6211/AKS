# 🧪 PRODUCTION TESTING CHECKLIST

## 🎯 CRITICAL TESTS (Must Pass Before Go-Live)

### Test 1: User Registration & Login ✓
```
1. Go to homepage
2. Click "Register"
3. Fill: Name, Email, Phone, Password
4. Submit → Should show success
5. Check email for welcome message
6. Logout
7. Login with same credentials
8. Verify logged in (see "Logout" link)

PASS CRITERIA: Can register, receive email, and login successfully
```

### Test 2: Auto-Fill Checkout ✓
```
PREREQUISITE: Must be logged in

1. Add any product to cart
2. Click cart icon
3. Observe:
   - Name field: Pre-filled ✓
   - Email field: Pre-filled ✓
   - Phone field: Pre-filled ✓
   - Address dropdown: Visible (if addresses saved)
4. Try selecting different address
5. Verify address text updates

PASS CRITERIA: All fields auto-populate from user profile
```

### Test 3: Product to Order Flow ✓
```
1. Browse products on homepage
2. Click "Add to Cart" on any product
3. Cart count increases (top right)
4. Open cart
5. Verify product appears
6. Increase quantity
7. Add another product
8. Verify subtotal calculates correctly
9. Fill delivery details (or use auto-fill)
10. Click "Proceed to Checkout"
11. Check email for order confirmation

PASS CRITERIA: Order created, email sent, cart cleared
```

### Test 4: Promo Code System ✓
```
PREREQUISITE: Admin created promo code "TEST10" (10% off, min ₹10)

1. Add products worth ₹100 to cart
2. Open cart
3. Enter "TEST10" in promo code field
4. Click "Apply"
5. Verify:
   - Green success message
   - Discount row shows -₹10
   - Total reduced to ₹90
6. Remove promo code
7. Verify discount removed

PASS CRITERIA: Promo validates, applies discount, removable
```

### Test 5: Stock Deduction ✓
```
PREREQUISITE: Admin access

1. Note product stock (e.g., Rice - 100 units)
2. Customer orders 5 units of Rice
3. Admin: Login to admin panel
4. Go to Orders tab
5. Find the new order
6. Change status to "Delivered"
7. Go to Products tab
8. Check Rice stock → Should be 95 units

PASS CRITERIA: Stock decreases when order delivered
```

### Test 6: Stock Restoration on Cancel ✓
```
PREREQUISITE: Order marked as Delivered

1. Admin: Go to Orders tab
2. Find delivered order
3. Change status to "Cancelled"
4. Enter cancellation reason
5. Go to Products tab
6. Verify stock restored to original

PASS CRITERIA: Stock increases back when order cancelled
```

### Test 7: Featured Reviews Display ✓
```
PREREQUISITE: At least 1 featured review in database

1. Go to homepage
2. Scroll to "What Our Customers Say" section
3. Verify reviews displayed
4. Check:
   - User name visible
   - Star rating (1-5) shown
   - Review text readable
   - Date displayed

PASS CRITERIA: Reviews load and display properly
```

### Test 8: Password Reset Flow ✓
```
1. Go to login page
2. Click "Forgot Password?"
3. Enter registered email
4. Submit
5. Check email for reset link
6. Click link in email
7. Enter new password
8. Submit
9. Redirected to login
10. Login with new password

PASS CRITERIA: Complete password reset without errors
```

### Test 9: Admin Dashboard ✓
```
PREREQUISITE: Admin login credentials

1. Login as admin
2. Dashboard should show:
   - Today's Orders count
   - Today's Sales amount (₹)
   - Pending Orders
   - Total Products
   - Low Stock Products
3. Click on each tab:
   - Products ✓
   - Orders ✓
   - Offers ✓
   - Customers ✓
4. Verify data loads

PASS CRITERIA: All dashboard stats accurate, tabs functional
```

### Test 10: Email Notifications ✓
```
Test these email types:

1. Welcome Email (Registration)
2. Order Confirmation (After checkout)
3. Order Status Update (Delivered)
4. Order Cancelled (With reason)
5. Password Reset Link

PASS CRITERIA: All 5 email types send successfully
```

---

## 🔄 INTEGRATION TESTS

### Mobile Responsiveness
```
Test on:
- [ ] iPhone (Safari)
- [ ] Android (Chrome)
- [ ] iPad (Safari)
- [ ] Desktop (Chrome, Firefox, Safari)

Check:
- [ ] Homepage loads
- [ ] Cart opens and scrolls
- [ ] Products display in grid
- [ ] Buttons are clickable
- [ ] Forms are usable
```

### Performance
```
- [ ] Homepage loads in < 3 seconds
- [ ] Products API responds in < 1 second
- [ ] Cart operations are instant
- [ ] No visible lag when scrolling
- [ ] Images load progressively
```

### Security
```
- [ ] Can't access admin without login
- [ ] Can't view other user's orders
- [ ] SQL injection attempts fail
- [ ] XSS attempts sanitized
- [ ] HTTPS enabled on both domains
```

---

## 🐛 KNOWN ISSUES TO VERIFY FIXED

### Fixed Issues (Should Work Now):
- [x] Cart flickering → Fixed (infinite loop removed)
- [x] Offers not loading → Fixed (global declaration)
- [x] Promo codes not working → Fixed (order of operations)
- [x] Password reset network error → Fixed (API_BASE_URL defined)
- [x] Stock not deducting → Fixed (auto-deduct on Delivered)
- [x] Today's sales showing ₹0 → Fixed (delivered_date tracking)

### Test These Were Actually Fixed:
```
1. Add product, open cart → No flickering ✓
2. Check offers section → Loads from database ✓
3. Apply promo code → Works correctly ✓
4. Reset password via email → No network error ✓
5. Deliver order → Stock decreases ✓
6. Check today's sales → Shows correct amount ✓
```

---

## 📊 DATA VALIDATION

### Database Integrity
```
Check MongoDB Atlas:

1. Users collection:
   - [ ] Passwords are hashed
   - [ ] Emails are unique
   - [ ] Addresses array exists

2. Products collection:
   - [ ] Stock values are positive
   - [ ] Prices are valid numbers
   - [ ] Images URLs work

3. Orders collection:
   - [ ] All have customer_info
   - [ ] Totals calculated correctly
   - [ ] Status values valid

4. Reviews collection:
   - [ ] Ratings between 1-5
   - [ ] Linked to valid orders
   - [ ] User names present
```

---

## 🎭 USER ACCEPTANCE TESTING (UAT)

### Scenario 1: First-Time Customer
```
Persona: Rajesh, 35, first online order

1. Discovers website via Google
2. Browses products
3. Adds items to cart
4. Registers account
5. Checks out
6. Receives order confirmation
7. Waits for delivery

Expected: Smooth experience, clear instructions
```

### Scenario 2: Returning Customer
```
Persona: Sunita, 40, has ordered before

1. Logs in
2. Adds items to cart
3. Details auto-fill ✓
4. Uses saved address ✓
5. Applies promo code ✓
6. Quick checkout
7. Reviews previous order

Expected: Faster than first time, convenient
```

### Scenario 3: Admin Managing Orders
```
Persona: Store manager, daily operations

1. Logs into admin panel
2. Sees 5 pending orders
3. Updates 2 to "Processing"
4. Marks 1 as "Delivered"
5. Cancels 1 with reason
6. Checks stock levels
7. Adds new product

Expected: Efficient, no confusion
```

---

## 🚀 GO-LIVE CHECKLIST

Before announcing to customers:

**Technical:**
- [ ] All 10 critical tests pass
- [ ] Mobile responsive on 3+ devices
- [ ] Emails delivering successfully
- [ ] Admin can manage orders
- [ ] Stock tracking working

**Content:**
- [ ] At least 20 products listed
- [ ] All product images loading
- [ ] Prices are correct
- [ ] 2-3 active offers/promo codes
- [ ] Contact information updated

**Business:**
- [ ] Payment method documented (COD only?)
- [ ] Delivery area defined (Barara + nearby?)
- [ ] Delivery charges set (₹40 < ₹500)
- [ ] Return policy page (optional)
- [ ] Terms & conditions (optional)

---

## 📈 POST-LAUNCH MONITORING (First Week)

### Day 1:
```
- [ ] Check every 2 hours for errors
- [ ] Monitor email delivery
- [ ] Respond to any customer issues
- [ ] Fix critical bugs immediately
```

### Day 2-3:
```
- [ ] Review all orders
- [ ] Check stock accuracy
- [ ] Read customer feedback
- [ ] Optimize slow pages
```

### Day 4-7:
```
- [ ] Analyze user behavior
- [ ] Identify popular products
- [ ] Adjust offers based on data
- [ ] Plan Phase 2 features
```

---

## 🎯 SUCCESS METRICS

### Week 1 Goals:
- Orders: 10+ orders
- Registration: 20+ users
- Cart abandonment: < 50%
- Email delivery: > 95%
- Zero critical bugs

### Week 2-4 Goals:
- Orders: 50+ orders
- Repeat customers: 20%
- Average order value: ₹300+
- Customer reviews: 5+ reviews
- Feature 3+ reviews on homepage

---

## 🆘 EMERGENCY PROCEDURES

### If Site Goes Down:
```
1. Check Render.com status
2. Check Vercel status
3. Review recent code changes
4. Check error logs
5. Rollback if needed
6. Notify customers via WhatsApp/SMS
```

### If Orders Not Processing:
```
1. Check backend logs
2. Verify MongoDB connection
3. Test order API manually
4. Check SendGrid quota
5. Process orders manually if needed
```

### If Stock Shows Wrong:
```
1. Check recent orders
2. Verify delivered orders
3. Review cancelled orders
4. Manual stock adjustment
5. Document discrepancy
```

---

## 📞 QUICK REFERENCE

### Important URLs:
```
Production Frontend: https://your-site.vercel.app
Production Backend: https://your-backend.onrender.com
Admin Panel: https://your-site.vercel.app/admin.html
MongoDB Atlas: https://cloud.mongodb.com
Render Dashboard: https://dashboard.render.com
Vercel Dashboard: https://vercel.com/dashboard
```

### Admin Credentials:
```
Email: (your admin email)
Password: (secure password)
KEEP THESE SAFE!
```

### Test User Credentials:
```
Email: test@example.com
Password: testpass123
Use for UAT testing
```

---

## ✅ FINAL PRE-LAUNCH CHECK

Run through this 5-minute checklist right before announcing:

```
1. Homepage loads: ✓ / ✗
2. Can register: ✓ / ✗
3. Can add to cart: ✓ / ✗
4. Checkout works: ✓ / ✗
5. Email sends: ✓ / ✗
6. Admin login works: ✓ / ✗
7. Can mark order delivered: ✓ / ✗
8. Stock decreases: ✓ / ✗
9. Mobile responsive: ✓ / ✗
10. All links work: ✓ / ✗

If all ✓ → GO LIVE! 🚀
If any ✗ → Fix before launch
```

---

*Testing Guide v1.0 - Production Ready*
*Test thoroughly, launch confidently!* 🎯
