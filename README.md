# Arun Karyana Store - E-Commerce Website

**Est. 1977 | Barara, Haryana**

A modern e-commerce platform for Arun Karyana Store - Your trusted neighborhood store since 1977.

---

## 🚀 Project Overview

This is a full-stack e-commerce website built with:
- **Frontend**: HTML5, CSS3 (Tailwind CSS), Vanilla JavaScript
- **Backend**: Python Flask with MongoDB
- **Database**: MongoDB Atlas (Free Tier)
- **Hosting**: 
  - Frontend: Netlify (Free Tier)
  - Backend: Render.com (Free Tier)

---

## 📁 Project Structure

```
webapp/
├── main.py                      # Flask backend (Enhanced with security)
├── requirements.txt             # Python dependencies
├── runtime.txt                  # Python version for Render
├── Procfile                     # Deployment configuration
├── render.yaml                  # Render.com configuration
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore file
├── config.js                    # Frontend configuration
├── index.html                   # Main homepage
├── login.html                   # Login/Register page
├── profile.html                 # User profile page
├── order-history.html           # Order history page
├── thank-you.html               # Order confirmation page
├── admin.html                   # Admin dashboard
└── docs/                        # Documentation folder
    ├── DEPLOYMENT_GUIDE.md      # Step-by-step deployment
    ├── API_DOCUMENTATION.md     # API endpoints reference
    ├── MAINTENANCE_GUIDE.md     # How to maintain the site
    └── USER_GUIDE.md            # For end users
```

---

## ✨ Features

### Customer Features
- 🛒 Browse products by category (Food, Beverages, Personal Care, Soaps)
- 🔍 Search functionality
- 🛍️ Shopping cart (persistent across sessions)
- 👤 User registration and login
- 📦 Order placement and tracking
- 📋 Order history
- 👤 Profile management

### Admin Features (Coming Soon)
- 📊 View all orders
- 👥 Manage users
- 📈 Basic analytics

### Technical Features
- ✅ Secure password hashing (bcrypt)
- ✅ Input validation and sanitization
- ✅ Rate limiting (protection against abuse)
- ✅ CORS configuration
- ✅ MongoDB indexes for performance
- ✅ Error logging
- ✅ Health check endpoint
- ✅ Mobile responsive design

---

## 🔧 Setup Instructions

### Prerequisites
- Python 3.11+
- MongoDB Atlas account (free tier)
- Git
- Render.com account (free)
- Netlify account (free)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd webapp
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB credentials
   ```

4. **Run the backend locally**
   ```bash
   python main.py
   ```
   Backend will run on `http://localhost:5000`

5. **Open frontend**
   - Open `index.html` in a web browser
   - Or use a local server:
     ```bash
     python -m http.server 8000
     ```
   - Access at `http://localhost:8000`

---

## 🚀 Deployment

### Backend Deployment (Render.com)

See **[DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)** for detailed step-by-step instructions.

Quick steps:
1. Push code to GitHub
2. Create new Web Service on Render.com
3. Connect your GitHub repository
4. Set environment variables
5. Deploy!

### Frontend Deployment (Netlify)

1. **Drag & Drop Method**:
   - Go to [Netlify](https://www.netlify.com/)
   - Drag your HTML files to the deploy zone
   - Done!

2. **Git Method**:
   - Connect your GitHub repository
   - Set build settings (none needed for static site)
   - Deploy

3. **Update Backend URL**:
   After backend deployment, update `config.js`:
   ```javascript
   BACKEND_URL: 'https://your-app-name.onrender.com'
   ```

---

## 🔐 Security Features

### Implemented
- ✅ Password hashing with bcrypt
- ✅ Input validation and sanitization
- ✅ Rate limiting on API endpoints
- ✅ CORS configured for specific frontend domain
- ✅ MongoDB connection pooling
- ✅ Error logging
- ✅ Database indexes for query optimization

### Recommended Enhancements (Future)
- JWT token-based authentication
- Email verification for new users
- Password reset functionality
- Two-factor authentication
- HTTPS enforcement

---

## 📊 API Endpoints

### Public Endpoints
- `GET /` - Health check
- `POST /register` - User registration
- `POST /login` - User login
- `POST /submit-order` - Place order
- `GET /cart/<user_id>` - Get user cart
- `POST /cart/update` - Update cart
- `GET /orders/<user_id>` - Get user orders
- `GET /profile/<user_id>` - Get user profile
- `POST /profile/update` - Update profile
- `GET /order/<order_id>` - Get order details
- `GET /user_role/<user_id>` - Get user role

### Admin Endpoints (Protected)
- `GET /admin/users` - Get all users
- `GET /admin/orders` - Get all orders

For detailed API documentation, see **[API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)**

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file with:

```env
# MongoDB Configuration
MONGO_USERNAME=your_username
MONGO_PASSWORD=your_password
MONGO_CLUSTER_URI=your_cluster.mongodb.net
MONGO_PARAMS=/?retryWrites=true&w=majority&appName=YourApp

# Security
JWT_SECRET_KEY=your_secret_key
SECRET_KEY=your_flask_secret

# Frontend
FRONTEND_URL=https://your-site.netlify.app

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
```

### Frontend Configuration

Edit `config.js`:
```javascript
const CONFIG = {
    BACKEND_URL: 'https://your-backend.onrender.com',
    DELIVERY_FEE: 40,
    // ... other settings
};
```

---

## 🐛 Troubleshooting

### Backend Issues

**Problem**: "Database connection not available"
- **Solution**: Check MongoDB credentials in environment variables
- Verify MongoDB Atlas allows connections from Render.com IP

**Problem**: "500 Internal Server Error"
- **Solution**: Check Render.com logs
- Verify all environment variables are set correctly

**Problem**: Backend is slow to respond
- **Solution**: Render free tier spins down after 15 minutes of inactivity
- First request after inactivity takes ~30 seconds

### Frontend Issues

**Problem**: "Failed to fetch"
- **Solution**: Check `config.js` has correct backend URL
- Verify backend is running
- Check browser console for CORS errors

**Problem**: Cart not persisting
- **Solution**: Ensure user is logged in
- Check localStorage is enabled in browser

---

## 📈 Monitoring

### Health Check
Visit `https://your-backend.onrender.com/health` to check backend status

### Logs
- Render.com dashboard → Your service → Logs tab
- Real-time logs of all requests and errors

### Uptime Monitoring
Set up free monitoring with:
- UptimeRobot (recommended)
- Pingdom
- StatusCake

See **[MAINTENANCE_GUIDE.md](docs/MAINTENANCE_GUIDE.md)** for detailed monitoring setup.

---

## 🚧 Known Limitations (Free Tier)

### Render.com Free Tier
- Spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds
- 750 hours/month (sufficient for small traffic)

### MongoDB Atlas Free Tier
- 512MB storage
- Shared cluster
- Limited to 100 connections

### Netlify Free Tier
- 100GB bandwidth/month
- Unlimited sites
- Automatic HTTPS

---

## 🔄 Updates & Maintenance

### Updating the Backend
1. Make changes to `main.py`
2. Test locally
3. Commit and push to GitHub
4. Render.com auto-deploys (if connected to GitHub)

### Updating the Frontend
1. Make changes to HTML files
2. Update `config.js` if needed
3. Re-deploy to Netlify

### Database Backups
- MongoDB Atlas free tier includes automated backups
- Manual backup: Use `mongodump` command
- See **[MAINTENANCE_GUIDE.md](docs/MAINTENANCE_GUIDE.md)**

---

## 📞 Support

For issues or questions:
- Check the **[docs/](docs/)** folder for detailed guides
- Review error logs on Render.com
- Contact: [Your contact information]

---

## 📜 License

© 2025 Arun Karyana Store. All rights reserved.

---

## 🙏 Acknowledgments

Built with assistance from Gemini 2.5 Lite and GenSpark AI.

**Technologies Used:**
- Flask
- MongoDB
- Tailwind CSS
- bcrypt
- Gunicorn
- And many more open-source libraries

---

**Made with ❤️ for Arun Karyana Store, Barara**
