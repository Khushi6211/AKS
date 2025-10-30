"""
Arun Karyana Store - Enhanced Flask Backend
Production-ready Flask application with security improvements, 
Cloudinary image hosting, SendGrid emails, and Sentry monitoring
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pymongo import MongoClient, ASCENDING
from bson.objectid import ObjectId
from functools import wraps
import os
import urllib.parse
import pymongo
import bcrypt
import datetime
import re
import jwt
import logging
from dotenv import load_dotenv
import cloudinary
import cloudinary.uploader
import cloudinary.api
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Email, To, Content
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

# Load environment variables
load_dotenv()

# Initialize Sentry for error tracking (optional - only if DSN is provided)
SENTRY_DSN = os.environ.get('SENTRY_DSN')
if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[FlaskIntegration()],
        traces_sample_rate=1.0,
        environment=os.environ.get('ENVIRONMENT', 'production')
    )

# Configure Cloudinary (optional - only if credentials are provided)
CLOUDINARY_CLOUD_NAME = os.environ.get('CLOUDINARY_CLOUD_NAME')
CLOUDINARY_API_KEY = os.environ.get('CLOUDINARY_API_KEY')
CLOUDINARY_API_SECRET = os.environ.get('CLOUDINARY_API_SECRET')

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True
    )

# Configure SendGrid (optional - only if API key is provided)
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
SENDGRID_FROM_EMAIL = os.environ.get('SENDGRID_FROM_EMAIL', 'noreply@arunkaryana.com')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create Flask application
app = Flask(__name__)

# Configuration from environment variables
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'change-this-secret-key-in-production')
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'change-this-jwt-secret-in-production')
JWT_EXPIRATION_HOURS = 24
FRONTEND_URL = os.environ.get('FRONTEND_URL', '*')

# Configure CORS - Restrict to frontend domain only
cors_origins = [FRONTEND_URL] if FRONTEND_URL != '*' else '*'
CORS(app, resources={r"/*": {
    "origins": cors_origins,
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization", "User-ID"],
    "supports_credentials": True
}})

# Configure rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# MongoDB Connection Setup
MONGO_USERNAME = os.environ.get('MONGO_USERNAME', 'arunflaskuser')
MONGO_PASSWORD = os.environ.get('MONGO_PASSWORD', 'Ash6211@')
MONGO_CLUSTER_URI = os.environ.get('MONGO_CLUSTER_URI', 'mystorecluster.d17bljx.mongodb.net')
MONGO_PARAMS = os.environ.get('MONGO_PARAMS', '/?retryWrites=true&w=majority&appName=MyStoreCluster')

encoded_username = urllib.parse.quote_plus(MONGO_USERNAME)
encoded_password = urllib.parse.quote_plus(MONGO_PASSWORD)
mongo_uri = f"mongodb+srv://{encoded_username}:{encoded_password}@{MONGO_CLUSTER_URI}{MONGO_PARAMS}"

logger.info(f"Connecting to MongoDB... (pymongo version: {pymongo.version})")

# Initialize MongoDB collections
client = None
db = None
users_collection = None
products_collection = None
orders_collection = None
carts_collection = None

def initialize_database():
    """Initialize database connection and collections"""
    global client, db, users_collection, products_collection, orders_collection, carts_collection
    
    try:
        client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            maxPoolSize=50
        )
        db = client.arun_karyana_store_db
        users_collection = db.users
        products_collection = db.products
        orders_collection = db.orders
        carts_collection = db.carts
        
        # Test connection
        client.admin.command('ping')
        logger.info("✅ Successfully connected to MongoDB!")
        
        # Create indexes for better performance
        users_collection.create_index([("email", ASCENDING)], unique=True, sparse=True)
        users_collection.create_index([("phone", ASCENDING)], unique=True, sparse=True)
        orders_collection.create_index([("user_id", ASCENDING)])
        orders_collection.create_index([("order_date", ASCENDING)])
        carts_collection.create_index([("user_id", ASCENDING)], unique=True)
        logger.info("✅ Database indexes created/verified")
        
        # Initialize products if empty
        if products_collection.count_documents({}) == 0:
            products = [
                {"_id": 1, "name": "Lux International Soap", "price": 83, "category": "soaps", "image": "https://i.ibb.co/SXTVLFc0/Screenshot-2025-05-04-233546.jpg"},
                {"_id": 2, "name": "Dove Cream Beauty Bar", "price": 60, "category": "soaps", "image": "https://i.ibb.co/1tnsrsCG/Screenshot-2025-05-04-233853.jpg"},
                {"_id": 3, "name": "Tata Salt (1kg)", "price": 27, "category": "food", "image": "https://i.ibb.co/0Vjxb9BW/Screenshot-2025-05-04-233959.jpg"},
                {"_id": 4, "name": "Fortune Sunflower Oil (1L)", "price": 157, "category": "food", "image": "https://i.ibb.co/8LQ47qtQ/Screenshot-2025-05-04-234101.jpg"},
                {"_id": 5, "name": "Tata Tea Gold (500g)", "price": 215, "category": "beverages", "image": "https://i.ibb.co/jk5rjgnx/Screenshot-2025-05-04-234155.jpg"},
                {"_id": 6, "name": "Nescafe Classic Coffee (100g)", "price": 285, "category": "beverages", "image": "https://i.ibb.co/zTgPrhJ0/Screenshot-2025-05-04-234245.jpg"},
                {"_id": 7, "name": "Head & Shoulders Shampoo (180ml)", "price": 138, "category": "personal-care", "image": "https://i.ibb.co/5XkCdLn6/Screenshot-2025-05-04-234334.jpg"},
                {"_id": 8, "name": "Colgate Toothpaste (100g)", "price": 73, "category": "personal-care", "image": "https://i.ibb.co/ksmMDzB2/Screenshot-2025-05-04-234423.jpg"},
                {"_id": 9, "name": "Surf Excel Matic Powder (1kg)", "price": 175, "category": "soaps", "image": "https://i.ibb.co/xKPBGhYs/Screenshot-2025-05-04-234625.jpg"},
                {"_id": 10, "name": "Aashirvaad Atta (5kg)", "price": 250, "category": "food", "image": "https://i.ibb.co/fz1BHxGH/Screenshot-2025-05-04-234719.jpg"},
                {"_id": 11, "name": "Maggi Noodles (Pack of 4)", "price": 56, "category": "food", "image": "https://i.ibb.co/wxX6H6K/Screenshot-2025-05-04-234752.jpg"},
                {"_id": 12, "name": "Patanjali Dant Kanti (100g)", "price": 60, "category": "personal-care", "image": "https://i.ibb.co/Qvbsst5t/Screenshot-2025-05-04-234828.jpg"}
            ]
            products_collection.insert_many(products)
            logger.info("✅ Initial products added to database")
            
    except Exception as e:
        logger.error(f"❌ Error connecting to MongoDB: {e}")
        raise

# Initialize database on startup
initialize_database()

# Input validation helpers
def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_phone(phone):
    """Validate Indian phone number format"""
    pattern = r'^[6-9]\d{9}$'
    return re.match(pattern, str(phone).replace('+91', '').replace('-', '').replace(' ', '')) is not None

def sanitize_string(text):
    """Basic sanitization to prevent XSS"""
    if not text:
        return text
    # Remove potentially dangerous characters
    return re.sub(r'[<>"\']', '', str(text))

# Cloudinary helper functions
def upload_image_to_cloudinary(image_data, folder="products"):
    """Upload image to Cloudinary and return URL"""
    try:
        if not CLOUDINARY_CLOUD_NAME:
            return {"success": False, "message": "Cloudinary not configured"}
        
        # Upload image
        upload_result = cloudinary.uploader.upload(
            image_data,
            folder=f"arun-karyana/{folder}",
            allowed_formats=['jpg', 'png', 'jpeg', 'webp'],
            transformation=[
                {'width': 800, 'height': 800, 'crop': 'limit'},
                {'quality': 'auto:good'},
                {'fetch_format': 'auto'}
            ]
        )
        
        return {
            "success": True,
            "url": upload_result['secure_url'],
            "public_id": upload_result['public_id']
        }
    except Exception as e:
        logger.error(f"❌ Cloudinary upload error: {e}")
        return {"success": False, "message": str(e)}

def delete_image_from_cloudinary(public_id):
    """Delete image from Cloudinary"""
    try:
        if not CLOUDINARY_CLOUD_NAME:
            return {"success": False, "message": "Cloudinary not configured"}
        
        result = cloudinary.uploader.destroy(public_id)
        return {"success": True, "result": result}
    except Exception as e:
        logger.error(f"❌ Cloudinary delete error: {e}")
        return {"success": False, "message": str(e)}

# SendGrid email helper functions
def send_email(to_email, subject, html_content, plain_content=None):
    """Send email via SendGrid"""
    try:
        if not SENDGRID_API_KEY:
            logger.warning("SendGrid not configured - email not sent")
            return {"success": False, "message": "Email service not configured"}
        
        message = Mail(
            from_email=Email(SENDGRID_FROM_EMAIL, "Arun Karyana Store"),
            to_emails=To(to_email),
            subject=subject,
            html_content=Content("text/html", html_content)
        )
        
        if plain_content:
            message.plain_text_content = Content("text/plain", plain_content)
        
        sg = SendGridAPIClient(SENDGRID_API_KEY)
        response = sg.send(message)
        
        logger.info(f"✅ Email sent to {to_email}: {subject}")
        return {"success": True, "status_code": response.status_code}
    except Exception as e:
        logger.error(f"❌ SendGrid email error: {e}")
        return {"success": False, "message": str(e)}

def send_order_confirmation_email(order_data, customer_email):
    """Send order confirmation email"""
    subject = f"Order Confirmation - #{order_data['order_id']}"
    
    # Build items HTML
    items_html = ""
    for item in order_data['items']:
        items_html += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">{item['name']}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">{item['quantity']}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹{item['price']}</td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹{item['price'] * item['quantity']}</td>
        </tr>
        """
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Thank You for Your Order! 🎉</h1>
            <p style="margin: 10px 0 0; font-size: 16px;">Arun Karyana Store</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Dear {order_data['customer_name']},</p>
            
            <p>Your order has been successfully placed and will be processed shortly.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="color: #667eea; margin-top: 0;">Order Details</h2>
                <p><strong>Order ID:</strong> #{order_data['order_id']}</p>
                <p><strong>Order Date:</strong> {order_data['order_date']}</p>
                <p><strong>Status:</strong> <span style="color: #f59e0b;">Pending</span></p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #667eea; margin-top: 0;">Items Ordered</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f3f4f6;">
                            <th style="padding: 10px; text-align: left;">Product</th>
                            <th style="padding: 10px; text-align: center;">Qty</th>
                            <th style="padding: 10px; text-align: right;">Price</th>
                            <th style="padding: 10px; text-align: right;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items_html}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold;">Subtotal:</td>
                            <td style="padding: 10px; text-align: right; font-weight: bold;">₹{order_data['subtotal']}</td>
                        </tr>
                        <tr>
                            <td colspan="3" style="padding: 10px; text-align: right;">Delivery Fee:</td>
                            <td style="padding: 10px; text-align: right;">₹{order_data['delivery_fee']}</td>
                        </tr>
                        <tr style="background: #f3f4f6;">
                            <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold; font-size: 18px;">Total Amount:</td>
                            <td style="padding: 10px; text-align: right; font-weight: bold; font-size: 18px; color: #667eea;">₹{order_data['total_amount']}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #667eea; margin-top: 0;">Delivery Address</h3>
                <p style="margin: 5px 0;"><strong>{order_data['customer_name']}</strong></p>
                <p style="margin: 5px 0;">{order_data['customer_phone']}</p>
                <p style="margin: 5px 0;">{order_data['customer_address']}</p>
            </div>
            
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0;"><strong>📦 What's Next?</strong></p>
                <p style="margin: 10px 0 0;">Our team will process your order and contact you shortly for delivery confirmation.</p>
            </div>
            
            <p style="margin-top: 30px;">If you have any questions, please contact us:</p>
            <p style="margin: 5px 0;">📞 Phone: +91-XXXXXXXXXX</p>
            <p style="margin: 5px 0;">📍 Railway Road, Barara, Ambala, Haryana 133201</p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 14px;">Thank you for shopping with Arun Karyana Store!</p>
                <p style="color: #6b7280; font-size: 12px; margin-top: 10px;">Serving Barara since 1977</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(customer_email, subject, html_content)

def send_order_status_update_email(order_data, customer_email, new_status):
    """Send order status update email"""
    status_messages = {
        "Processing": "Your order is now being prepared! 📦",
        "Out for Delivery": "Your order is on its way! 🚚",
        "Delivered": "Your order has been delivered! ✅",
        "Cancelled": "Your order has been cancelled. 🚫"
    }
    
    subject = f"Order Status Update - #{order_data['order_id']}"
    status_message = status_messages.get(new_status, f"Order status updated to: {new_status}")
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Order Status Updated</h1>
            <p style="margin: 10px 0 0; font-size: 16px;">Arun Karyana Store</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Dear {order_data['customer_name']},</p>
            
            <div style="background: white; padding: 25px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p style="font-size: 24px; margin: 0; color: #667eea; font-weight: bold;">{status_message}</p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h2 style="color: #667eea; margin-top: 0;">Order Details</h2>
                <p><strong>Order ID:</strong> #{order_data['order_id']}</p>
                <p><strong>Total Amount:</strong> ₹{order_data['total_amount']}</p>
                <p><strong>Current Status:</strong> <span style="color: #667eea; font-weight: bold;">{new_status}</span></p>
            </div>
            
            <p style="margin-top: 30px;">If you have any questions, please contact us:</p>
            <p style="margin: 5px 0;">📞 Phone: +91-XXXXXXXXXX</p>
            <p style="margin: 5px 0;">📍 Railway Road, Barara, Ambala, Haryana 133201</p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 14px;">Thank you for shopping with Arun Karyana Store!</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(customer_email, subject, html_content)

# Security decorator for admin routes
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = request.headers.get('User-ID')
        if not user_id:
            logger.warning("Admin access attempted without User-ID")
            return jsonify({"success": False, "message": "Authentication required."}), 401
        
        try:
            user = users_collection.find_one({"_id": ObjectId(user_id)})
            if not user or user.get('role') != 'admin':
                logger.warning(f"Unauthorized admin access attempt by user: {user_id}")
                return jsonify({"success": False, "message": "Admin access required."}), 403
        except Exception as e:
            logger.error(f"Error verifying admin access: {e}")
            return jsonify({"success": False, "message": "Invalid User ID or server error."}), 401
        
        return f(*args, **kwargs)
    return decorated_function

# Health check endpoint
@app.route('/')
@app.route('/health')
def health_check():
    """Health check endpoint for monitoring"""
    try:
        # Test database connection
        client.admin.command('ping')
        return jsonify({
            "status": "healthy",
            "service": "Arun Karyana Store Backend",
            "database": "connected",
            "version": "2.0"
        }), 200
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            "status": "unhealthy",
            "service": "Arun Karyana Store Backend",
            "database": "disconnected",
            "error": str(e)
        }), 500

# User Registration
@app.route('/register', methods=['POST'])
@limiter.limit("5 per minute")
def register_user():
    """Register a new user"""
    try:
        if users_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data provided."}), 400
        
        # Validate required fields
        required_fields = ['name', 'email', 'phone', 'password', 'confirm_password']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({"success": False, "message": f"Missing required field: {field}"}), 400
        
        # Sanitize inputs
        name = sanitize_string(data['name'].strip())
        email = data['email'].strip().lower()
        phone = data['phone'].strip()
        password = data['password']
        confirm_password = data['confirm_password']
        
        # Validate inputs
        if not validate_email(email):
            return jsonify({"success": False, "message": "Invalid email format."}), 400
        
        if not validate_phone(phone):
            return jsonify({"success": False, "message": "Invalid phone number. Please enter a valid 10-digit Indian phone number."}), 400
        
        if password != confirm_password:
            return jsonify({"success": False, "message": "Password and Confirm Password do not match."}), 400
        
        if len(password) < 8:
            return jsonify({"success": False, "message": "Password must be at least 8 characters long."}), 400
        
        # Check for existing user
        existing_user = users_collection.find_one({"$or": [{"email": email}, {"phone": phone}]})
        if existing_user:
            return jsonify({"success": False, "message": "User with this email or phone number already exists."}), 409
        
        # Hash password
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        
        # Create new user
        new_user = {
            "name": name,
            "email": email,
            "phone": phone,
            "password": hashed_password,
            "created_at": datetime.datetime.utcnow(),
            "role": "customer"
        }
        
        inserted_user = users_collection.insert_one(new_user)
        
        # Create empty cart for user
        carts_collection.insert_one({
            "user_id": str(inserted_user.inserted_id),
            "items": [],
            "created_at": datetime.datetime.utcnow()
        })
        
        logger.info(f"✅ New user registered: {email}")
        return jsonify({"success": True, "message": "Registration successful!"}), 201
        
    except Exception as e:
        logger.error(f"❌ Registration error: {e}")
        return jsonify({"success": False, "message": "An error occurred during registration."}), 500

# User Login
@app.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login_user():
    """User login endpoint"""
    try:
        if users_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data provided."}), 400
        
        email_phone = data.get('email_phone', '').strip().lower()
        password = data.get('password', '')
        
        if not email_phone or not password:
            return jsonify({"success": False, "message": "Email/Phone and password are required."}), 400
        
        # Find user
        user = users_collection.find_one({"$or": [{"email": email_phone}, {"phone": email_phone}]})
        
        if user and bcrypt.checkpw(password.encode('utf-8'), user['password']):
            user_id = str(user['_id'])
            logger.info(f"✅ User logged in: {email_phone}")
            return jsonify({
                "success": True,
                "message": "Login successful!",
                "user_id": user_id,
                "name": user.get('name'),
                "role": user.get('role', 'customer')
            }), 200
        else:
            logger.warning(f"⚠️ Failed login attempt for: {email_phone}")
            return jsonify({"success": False, "message": "Invalid email/phone or password."}), 401
            
    except Exception as e:
        logger.error(f"❌ Login error: {e}")
        return jsonify({"success": False, "message": "An error occurred during login."}), 500

# Submit Order
@app.route('/submit-order', methods=['POST'])
@limiter.limit("10 per minute")
def submit_order():
    """Submit a new order"""
    try:
        if orders_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data provided."}), 400
        
        # Validate required fields
        required_fields = ['customer', 'items', 'total']
        for field in required_fields:
            if field not in data:
                return jsonify({"success": False, "message": f"Missing required field: {field}"}), 400
        
        # Validate customer info
        customer = data['customer']
        customer_fields = ['name', 'phone', 'address']
        if not isinstance(customer, dict) or not all(field in customer and customer[field] for field in customer_fields):
            return jsonify({"success": False, "message": "Missing or incomplete customer details."}), 400
        
        # Validate items
        if not data['items'] or not isinstance(data['items'], list):
            return jsonify({"success": False, "message": "Order must contain items."}), 400
        
        # Sanitize customer info
        sanitized_customer = {
            "name": sanitize_string(customer['name']),
            "phone": customer['phone'],
            "address": sanitize_string(customer['address'])
        }
        
        # Add email if provided
        if customer.get('email'):
            sanitized_customer['email'] = customer['email'].strip().lower()
        
        # Create order
        new_order = {
            "customer_info": sanitized_customer,
            "items": data['items'],
            "subtotal": data.get('subtotal'),
            "delivery_fee": data.get('deliveryFee', 0),
            "total_amount": data['total'],
            "order_date": datetime.datetime.utcnow(),
            "status": "Pending",
            "user_id": data.get('user_id')
        }
        
        inserted_order = orders_collection.insert_one(new_order)
        order_id = str(inserted_order.inserted_id)
        
        # Send order confirmation email if customer email is provided
        if sanitized_customer.get('email') and validate_email(sanitized_customer.get('email', '')):
            order_email_data = {
                "order_id": order_id,
                "customer_name": sanitized_customer['name'],
                "customer_phone": sanitized_customer['phone'],
                "customer_address": sanitized_customer['address'],
                "items": data['items'],
                "subtotal": data.get('subtotal', 0),
                "delivery_fee": data.get('deliveryFee', 0),
                "total_amount": data['total'],
                "order_date": datetime.datetime.utcnow().strftime('%B %d, %Y at %I:%M %p')
            }
            send_order_confirmation_email(order_email_data, sanitized_customer['email'])
        
        logger.info(f"✅ Order placed: {order_id}")
        return jsonify({
            "success": True,
            "message": "Order placed successfully!",
            "order_id": order_id
        }), 201
        
    except Exception as e:
        logger.error(f"❌ Order submission error: {e}")
        return jsonify({"success": False, "message": "An error occurred while placing the order."}), 500

# Get Cart
@app.route('/cart/<user_id>', methods=['GET'])
def get_cart(user_id):
    """Get user's cart"""
    try:
        if carts_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        cart_document = carts_collection.find_one({"user_id": user_id})
        cart_items = cart_document.get('items', []) if cart_document else []
        
        return jsonify({"success": True, "cart": cart_items}), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching cart for user {user_id}: {e}")
        return jsonify({"success": False, "message": "An error occurred while fetching the cart."}), 500

# Update Cart
@app.route('/cart/update', methods=['POST'])
@limiter.limit("30 per minute")
def update_cart():
    """Update user's cart"""
    try:
        if carts_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        data = request.get_json()
        if not data or 'user_id' not in data or 'items' not in data:
            return jsonify({"success": False, "message": "Missing required fields."}), 400
        
        user_id = data['user_id']
        cart_items = data['items']
        
        carts_collection.update_one(
            {"user_id": user_id},
            {"$set": {"items": cart_items, "last_updated": datetime.datetime.utcnow()}},
            upsert=True
        )
        
        return jsonify({"success": True, "message": "Cart updated successfully."}), 200
        
    except Exception as e:
        logger.error(f"❌ Error updating cart: {e}")
        return jsonify({"success": False, "message": "An error occurred while updating the cart."}), 500

# Get User Orders
@app.route('/orders/<user_id>', methods=['GET'])
def get_user_orders(user_id):
    """Get all orders for a user"""
    try:
        if orders_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        orders_cursor = orders_collection.find({"user_id": user_id}).sort("order_date", -1)
        orders_list = []
        
        for order in orders_cursor:
            order['_id'] = str(order['_id'])
            if 'order_date' in order and isinstance(order['order_date'], datetime.datetime):
                order['order_date'] = order['order_date'].isoformat()
            orders_list.append(order)
        
        return jsonify({"success": True, "orders": orders_list}), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching orders for user {user_id}: {e}")
        return jsonify({"success": False, "message": "An error occurred while fetching orders."}), 500

# Get User Profile
@app.route('/profile/<user_id>', methods=['GET'])
def get_user_profile(user_id):
    """Get user profile"""
    try:
        if users_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        user_document = users_collection.find_one({"_id": ObjectId(user_id)})
        
        if not user_document:
            return jsonify({"success": False, "message": "User not found."}), 404
        
        user_data = {
            "_id": str(user_document['_id']),
            "name": user_document.get('name'),
            "email": user_document.get('email'),
            "phone": user_document.get('phone'),
            "created_at": user_document.get('created_at').isoformat() if user_document.get('created_at') else None,
            "role": user_document.get('role', 'customer')
        }
        
        return jsonify({"success": True, "user": user_data}), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching profile for user {user_id}: {e}")
        return jsonify({"success": False, "message": "An error occurred while fetching the profile."}), 500

# Update User Profile
@app.route('/profile/update', methods=['POST'])
@limiter.limit("10 per minute")
def update_user_profile():
    """Update user profile"""
    try:
        if users_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        data = request.get_json()
        if not data or 'user_id' not in data:
            return jsonify({"success": False, "message": "Missing user ID."}), 400
        
        user_id = data['user_id']
        update_fields = {}
        
        if 'name' in data and data['name']:
            update_fields['name'] = sanitize_string(data['name'])
        
        if 'email' in data and data['email']:
            email = data['email'].strip().lower()
            if validate_email(email):
                update_fields['email'] = email
            else:
                return jsonify({"success": False, "message": "Invalid email format."}), 400
        
        if 'phone' in data and data['phone']:
            phone = data['phone'].strip()
            if validate_phone(phone):
                update_fields['phone'] = phone
            else:
                return jsonify({"success": False, "message": "Invalid phone number."}), 400
        
        if not update_fields:
            return jsonify({"success": False, "message": "No valid fields provided for update."}), 400
        
        update_result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_fields}
        )
        
        if update_result.matched_count > 0:
            logger.info(f"✅ Profile updated for user: {user_id}")
            return jsonify({"success": True, "message": "Profile updated successfully."}), 200
        else:
            return jsonify({"success": False, "message": "User not found."}), 404
            
    except Exception as e:
        logger.error(f"❌ Error updating profile: {e}")
        return jsonify({"success": False, "message": "An error occurred while updating the profile."}), 500

# Get Order Details
@app.route('/order/<order_id>', methods=['GET'])
def get_order_details(order_id):
    """Get details of a specific order"""
    try:
        if orders_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        order_document = orders_collection.find_one({"_id": ObjectId(order_id)})
        
        if not order_document:
            return jsonify({"success": False, "message": "Order not found."}), 404
        
        order_document['_id'] = str(order_document['_id'])
        if 'order_date' in order_document and isinstance(order_document['order_date'], datetime.datetime):
            order_document['order_date'] = order_document['order_date'].isoformat()
        
        return jsonify({
            "success": True,
            "message": "Order found",
            "order": order_document
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching order {order_id}: {e}")
        return jsonify({"success": False, "message": "An error occurred while fetching order details."}), 500

# Get User Role
@app.route('/user_role/<user_id>', methods=['GET'])
def get_user_role(user_id):
    """Get user role"""
    try:
        if users_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        user = users_collection.find_one({"_id": ObjectId(user_id)}, {"role": 1})
        
        if user:
            return jsonify({"success": True, "role": user.get('role', 'customer')}), 200
        else:
            return jsonify({"success": False, "message": "User not found!"}), 404
            
    except Exception as e:
        logger.error(f"❌ Error fetching user role: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Admin: Get All Users
@app.route('/admin/users', methods=['GET'])
@admin_required
def get_all_users():
    """Get all users (admin only)"""
    try:
        if users_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        users = list(users_collection.find({}, {'password': 0}))
        
        for user in users:
            user['_id'] = str(user['_id'])
            if 'created_at' in user and isinstance(user['created_at'], datetime.datetime):
                user['created_at'] = user['created_at'].isoformat()
            user['role'] = user.get('role', 'customer')
        
        return jsonify({"success": True, "users": users}), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching all users: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Admin: Get All Orders
@app.route('/admin/orders', methods=['GET'])
@admin_required
def get_all_orders():
    """Get all orders (admin only)"""
    try:
        if orders_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        orders = list(orders_collection.find({}).sort("order_date", -1))
        
        for order in orders:
            order['_id'] = str(order['_id'])
            if 'order_date' in order and isinstance(order['order_date'], datetime.datetime):
                order['order_date'] = order['order_date'].isoformat()
        
        return jsonify({"success": True, "orders": orders}), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching all orders: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Admin: Get Dashboard Statistics
@app.route('/admin/dashboard/stats', methods=['GET'])
@admin_required
def get_dashboard_stats():
    """Get dashboard statistics (admin only)"""
    try:
        # Get today's date range
        today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + datetime.timedelta(days=1)
        
        # Count today's orders
        todays_orders = orders_collection.count_documents({
            "order_date": {"$gte": today_start, "$lt": today_end}
        })
        
        # Calculate today's sales
        today_pipeline = [
            {"$match": {"order_date": {"$gte": today_start, "$lt": today_end}}},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ]
        todays_sales_result = list(orders_collection.aggregate(today_pipeline))
        todays_sales = todays_sales_result[0]['total'] if todays_sales_result else 0
        
        # Count pending orders
        pending_orders = orders_collection.count_documents({"status": "Pending"})
        
        # Count total products
        total_products = products_collection.count_documents({})
        
        # Count low stock products (if stock field exists)
        low_stock_products = products_collection.count_documents({"stock": {"$lt": 10, "$exists": True}})
        
        # Count total customers
        total_customers = users_collection.count_documents({"role": "customer"})
        
        # Get recent orders (last 5)
        recent_orders = list(orders_collection.find({}).sort("order_date", -1).limit(5))
        for order in recent_orders:
            order['_id'] = str(order['_id'])
            if 'order_date' in order and isinstance(order['order_date'], datetime.datetime):
                order['order_date'] = order['order_date'].isoformat()
        
        stats = {
            "todays_orders": todays_orders,
            "todays_sales": round(todays_sales, 2),
            "pending_orders": pending_orders,
            "total_products": total_products,
            "low_stock_products": low_stock_products,
            "total_customers": total_customers,
            "recent_orders": recent_orders
        }
        
        return jsonify({"success": True, "stats": stats}), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching dashboard stats: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Admin: Get All Products
@app.route('/admin/products', methods=['GET'])
@admin_required
def get_all_products():
    """Get all products (admin only)"""
    try:
        products = list(products_collection.find({}))
        
        for product in products:
            product['_id'] = str(product['_id'])
        
        return jsonify({"success": True, "products": products}), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching products: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Admin: Add Product
@app.route('/admin/products/add', methods=['POST'])
@admin_required
@limiter.limit("20 per minute")
def add_product():
    """Add new product (admin only)"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'price', 'category']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({"success": False, "message": f"Missing required field: {field}"}), 400
        
        # Sanitize inputs
        new_product = {
            "name": sanitize_string(data['name']),
            "price": float(data['price']),
            "category": sanitize_string(data['category']),
            "image": data.get('image', ''),
            "description": sanitize_string(data.get('description', '')),
            "stock": int(data.get('stock', 0)),
            "cloudinary_public_id": data.get('cloudinary_public_id'),
            "created_at": datetime.datetime.utcnow(),
            "updated_at": datetime.datetime.utcnow()
        }
        
        result = products_collection.insert_one(new_product)
        
        logger.info(f"✅ Product added: {new_product['name']}")
        return jsonify({
            "success": True,
            "message": "Product added successfully!",
            "product_id": str(result.inserted_id)
        }), 201
        
    except Exception as e:
        logger.error(f"❌ Error adding product: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Admin: Update Product
@app.route('/admin/products/update/<product_id>', methods=['PUT'])
@admin_required
@limiter.limit("20 per minute")
def update_product(product_id):
    """Update product (admin only)"""
    try:
        data = request.get_json()
        
        # Build update fields
        update_fields = {"updated_at": datetime.datetime.utcnow()}
        
        if 'name' in data:
            update_fields['name'] = sanitize_string(data['name'])
        if 'price' in data:
            update_fields['price'] = float(data['price'])
        if 'category' in data:
            update_fields['category'] = sanitize_string(data['category'])
        if 'image' in data:
            update_fields['image'] = data['image']
        if 'description' in data:
            update_fields['description'] = sanitize_string(data['description'])
        if 'stock' in data:
            update_fields['stock'] = int(data['stock'])
        if 'cloudinary_public_id' in data:
            update_fields['cloudinary_public_id'] = data['cloudinary_public_id']
        
        # Check if product_id is numeric (old format) or ObjectId
        try:
            query = {"_id": int(product_id)}
        except ValueError:
            query = {"_id": ObjectId(product_id)}
        
        result = products_collection.update_one(query, {"$set": update_fields})
        
        if result.matched_count > 0:
            logger.info(f"✅ Product updated: {product_id}")
            return jsonify({"success": True, "message": "Product updated successfully!"}), 200
        else:
            return jsonify({"success": False, "message": "Product not found."}), 404
        
    except Exception as e:
        logger.error(f"❌ Error updating product: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Admin: Delete Product
@app.route('/admin/products/delete/<product_id>', methods=['DELETE'])
@admin_required
@limiter.limit("20 per minute")
def delete_product(product_id):
    """Delete product (admin only)"""
    try:
        # Get product to check for Cloudinary image
        try:
            query = {"_id": int(product_id)}
        except ValueError:
            query = {"_id": ObjectId(product_id)}
        
        product = products_collection.find_one(query)
        
        if not product:
            return jsonify({"success": False, "message": "Product not found."}), 404
        
        # Delete from Cloudinary if public_id exists
        if product.get('cloudinary_public_id'):
            delete_image_from_cloudinary(product['cloudinary_public_id'])
        
        # Delete from database
        result = products_collection.delete_one(query)
        
        if result.deleted_count > 0:
            logger.info(f"✅ Product deleted: {product_id}")
            return jsonify({"success": True, "message": "Product deleted successfully!"}), 200
        else:
            return jsonify({"success": False, "message": "Failed to delete product."}), 500
        
    except Exception as e:
        logger.error(f"❌ Error deleting product: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Admin: Upload Image to Cloudinary
@app.route('/admin/upload-image', methods=['POST'])
@admin_required
@limiter.limit("20 per minute")
def upload_product_image():
    """Upload image to Cloudinary (admin only)"""
    try:
        data = request.get_json()
        
        if 'image_data' not in data:
            return jsonify({"success": False, "message": "No image data provided."}), 400
        
        # Upload to Cloudinary
        result = upload_image_to_cloudinary(data['image_data'], folder="products")
        
        if result['success']:
            logger.info(f"✅ Image uploaded to Cloudinary")
            return jsonify(result), 200
        else:
            return jsonify(result), 500
        
    except Exception as e:
        logger.error(f"❌ Error uploading image: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Admin: Update Order Status
@app.route('/admin/orders/update-status', methods=['PUT'])
@admin_required
@limiter.limit("30 per minute")
def update_order_status():
    """Update order status (admin only)"""
    try:
        data = request.get_json()
        
        if 'order_id' not in data or 'status' not in data:
            return jsonify({"success": False, "message": "Missing order_id or status."}), 400
        
        order_id = data['order_id']
        new_status = data['status']
        
        # Validate status
        valid_statuses = ['Pending', 'Processing', 'Out for Delivery', 'Delivered', 'Cancelled']
        if new_status not in valid_statuses:
            return jsonify({"success": False, "message": "Invalid status."}), 400
        
        # Get order
        order = orders_collection.find_one({"_id": ObjectId(order_id)})
        
        if not order:
            return jsonify({"success": False, "message": "Order not found."}), 404
        
        # Update order status
        update_data = {
            "status": new_status,
            "updated_at": datetime.datetime.utcnow()
        }
        
        # Add status history
        status_history_entry = {
            "status": new_status,
            "timestamp": datetime.datetime.utcnow(),
            "updated_by": request.headers.get('User-ID')
        }
        
        result = orders_collection.update_one(
            {"_id": ObjectId(order_id)},
            {
                "$set": update_data,
                "$push": {"status_history": status_history_entry}
            }
        )
        
        if result.modified_count > 0:
            # Send email notification if customer has email
            if order.get('customer_info', {}).get('email'):
                order_data = {
                    "order_id": str(order['_id']),
                    "customer_name": order['customer_info'].get('name', 'Customer'),
                    "total_amount": order.get('total_amount', 0)
                }
                send_order_status_update_email(
                    order_data,
                    order['customer_info']['email'],
                    new_status
                )
            
            logger.info(f"✅ Order status updated: {order_id} -> {new_status}")
            return jsonify({"success": True, "message": "Order status updated successfully!"}), 200
        else:
            return jsonify({"success": False, "message": "Failed to update order status."}), 500
        
    except Exception as e:
        logger.error(f"❌ Error updating order status: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Admin: Get Customer Statistics
@app.route('/admin/customers/stats', methods=['GET'])
@admin_required
def get_customer_stats():
    """Get customer statistics with order counts and total spent (admin only)"""
    try:
        # Aggregate customers with their order statistics
        pipeline = [
            {
                "$lookup": {
                    "from": "orders",
                    "localField": "_id",
                    "foreignField": "user_id",
                    "as": "orders"
                }
            },
            {
                "$project": {
                    "_id": 1,
                    "name": 1,
                    "email": 1,
                    "phone": 1,
                    "created_at": 1,
                    "order_count": {"$size": "$orders"},
                    "total_spent": {"$sum": "$orders.total_amount"}
                }
            },
            {"$sort": {"total_spent": -1}}
        ]
        
        # Note: This pipeline assumes user_id in orders is string format
        # We'll need to handle the conversion differently
        
        # Alternative approach: Get all users and calculate stats separately
        users = list(users_collection.find({"role": "customer"}, {"password": 0}))
        
        for user in users:
            user_id = str(user['_id'])
            user['_id'] = user_id
            
            # Count orders
            user['order_count'] = orders_collection.count_documents({"user_id": user_id})
            
            # Calculate total spent
            orders = list(orders_collection.find({"user_id": user_id}))
            user['total_spent'] = sum(order.get('total_amount', 0) for order in orders)
            
            # Format created_at
            if 'created_at' in user and isinstance(user['created_at'], datetime.datetime):
                user['created_at'] = user['created_at'].isoformat()
        
        # Sort by total spent
        users.sort(key=lambda x: x.get('total_spent', 0), reverse=True)
        
        return jsonify({"success": True, "customers": users}), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching customer stats: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Get All Products (Public)
@app.route('/products', methods=['GET'])
def get_products():
    """Get all products (public endpoint)"""
    try:
        products = list(products_collection.find({}))
        
        for product in products:
            product['_id'] = str(product['_id'])
        
        return jsonify({"success": True, "products": products}), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching products: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Error handlers
@app.errorhandler(429)
def ratelimit_handler(e):
    """Handle rate limit exceeded"""
    logger.warning(f"⚠️ Rate limit exceeded: {request.remote_addr}")
    return jsonify({
        "success": False,
        "message": "Too many requests. Please try again later."
    }), 429

@app.errorhandler(404)
def not_found(e):
    """Handle 404 errors"""
    return jsonify({
        "success": False,
        "message": "Resource not found"
    }), 404

@app.errorhandler(500)
def internal_error(e):
    """Handle 500 errors"""
    logger.error(f"❌ Internal server error: {e}")
    return jsonify({
        "success": False,
        "message": "Internal server error"
    }), 500

if __name__ == '__main__':
    # Use Gunicorn for production, this is just for local testing
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=False)
