# 🚀 Quick Reference - Arun Karyana Store

**Last Updated:** November 21, 2025

---

## 📱 Live URLs

| Service | URL | Status |
|---------|-----|--------|
| **Website** | https://arun-karyana.netlify.app | ✅ Live |
| **Backend API** | https://aks-backend.onrender.com | ✅ Live |
| **Admin Dashboard** | https://arun-karyana.netlify.app/admin-dashboard.html | ✅ Live |

---

## 🔑 Admin Credentials

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` on the Render backend (Environment tab) and redeploy.
That account is created (or promoted) as the store admin on startup; sign in at `/login.html`
and you are taken straight to the dashboard. See README → "Store dashboard (admin) access".

---

## 🎨 Brand Colors

```css
Primary (Warm Brown):  #9C6F44
Secondary (Light Gold): #E8C07D
Accent (Deeper Gold):  #B88B4A
Dark Grey:             #2D2D2D
Off-White:             #F8F5F0
```

**Logo URL:**  
`https://i.ibb.co/N6Q46Xdk/Vintage-Men-s-Portrait-in-Brown-Tones.png`

---

## 🛠️ Technology Stack

| Component | Technology | Hosting |
|-----------|-----------|---------|
| **Frontend** | HTML5, Tailwind CSS, JavaScript | Netlify (auto-deploy) |
| **Backend** | Python 3.11, Flask, Gunicorn | Render.com (manual deploy) |
| **Database** | MongoDB Atlas | Cloud |
| **Images** | Cloudinary | Free tier |
| **Email** | SendGrid | 100 emails/day |

---

## 📊 Database Collections

1. **products_collection** - All products
2. **orders_collection** - Customer orders
3. **users_collection** - User accounts
4. **offers_collection** - Promotional offers

---

## 🔧 Common Tasks

### Deploy Backend (Render)
1. Go to https://dashboard.render.com
2. Select "aks-backend" service
3. Click "Manual Deploy"
4. Select "Deploy latest commit"

### Deploy Frontend (Netlify)
✅ **Automatic** - Deploys on every git push to main branch

### Add New Product
1. Login to admin dashboard
2. Go to "Products" tab
3. Click "Add New Product"
4. Fill details and upload image
5. Click "Save Product"

### Manage Orders
1. Login to admin dashboard
2. Go to "Orders" tab
3. Click on order to view details
4. Update status: Pending → Processing → Out for Delivery → Delivered

### Add Promotional Offer
1. Login to admin dashboard
2. Go to "Offers" tab
3. Click "Add New Offer"
4. Set discount percentage and validity dates
5. Toggle "Active" to make visible on website

---

## 📧 Email Configuration

**SendGrid API Key Location:** Environment variable `SENDGRID_API_KEY`  
**From Email:** Your verified sender email  
**Email Types:**
- Order confirmation
- Order status updates
- Password reset

**To Fix Spam Issue:**  
👉 Read `SENDGRID_SPAM_PREVENTION_GUIDE.md`

---

## 🐛 Recent Bug Fixes (November 21, 2025)

✅ **Bug 1:** Admin offers tab infinite loading  
✅ **Bug 2:** Cart not working for new products  
✅ **Bug 3:** Forgot password design mismatch  
✅ **Bug 4:** Reset password link not working  
✅ **Bug 5:** Email styling mismatch + spam issue  

📄 **Full Details:** Read `BUG_FIXES_COMPLETED.md`

---

## 🧪 Testing Checklist

**After Every Deployment:**

- [ ] Test login (customer + admin)
- [ ] Add product to cart
- [ ] Place test order
- [ ] Check order email received
- [ ] Update order status from admin
- [ ] Test password reset flow
- [ ] Check offers tab in admin
- [ ] Verify mobile responsiveness

---

## 📞 Support & Documentation

| Document | Purpose |
|----------|---------|
| `README.md` | Project overview & setup |
| `BUG_FIXES_COMPLETED.md` | Detailed bug fix documentation |
| `SENDGRID_SPAM_PREVENTION_GUIDE.md` | Email deliverability guide |
| `TESTING_CHECKLIST.md` | Complete testing procedures |
| `QUICK_REFERENCE.md` | This file |

---

## ⚡ Quick Commands

### Check Backend Status
```bash
curl https://aks-backend.onrender.com/
```

### Check Frontend Status
```bash
curl https://arun-karyana.netlify.app/
```

### View Git Commits
```bash
git log --oneline -10
```

### Check MongoDB Connection
```bash
# In Python/Flask
if products_collection is not None:
    print("Database connected!")
```

---

## 🚨 Troubleshooting

### Website not loading?
- Check Netlify deployment status
- Clear browser cache (Ctrl + Shift + R)
- Wait 2-3 minutes for deployment

### Backend API errors?
- Check Render logs
- Manually trigger redeploy
- Verify MongoDB connection

### Emails not sending?
- Check SendGrid API key
- Verify sender email
- Check SendGrid dashboard for errors

### Cart not working?
- Check browser console (F12)
- Verify product IDs are strings (not numbers)
- Clear localStorage and retry

---

## 📈 Future Enhancements

**Phase 2 Ideas:**
- [ ] Add Sentry error tracking
- [ ] Customer order tracking page
- [ ] Email notification preferences
- [ ] Promotional SMS notifications
- [ ] Inventory management
- [ ] Sales analytics dashboard
- [ ] Customer loyalty program
- [ ] Multi-language support

---

## 💡 Important Notes

1. **Render Free Tier:** Backend sleeps after 15 min inactivity (first request may be slow)
2. **Netlify Free Tier:** 100 GB bandwidth/month, 300 build minutes/month
3. **SendGrid Free Tier:** 100 emails/day
4. **Cloudinary Free Tier:** 25 GB storage, 25 GB bandwidth/month
5. **MongoDB Atlas Free Tier:** 512 MB storage

---

## 📞 Contact Information

**Store Details:**  
Arun Karyana Store  
Railway Road, Barara  
Ambala, Haryana 133201  
India

**Owner:** Ashish Ji  
**Developer:** AI Assistant  
**Project Start:** November 2025  
**Current Phase:** Phase 1 Complete, Testing & Deployment

---

**Need Help?** Refer to detailed documentation files or ask your AI assistant! 🤖

---

*Last updated: November 21, 2025*
