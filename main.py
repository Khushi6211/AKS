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
import hashlib
import secrets
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
offers_collection = None
carts_collection = None
reviews_collection = None

def initialize_database():
    """Initialize database connection and collections"""
    global client, db, users_collection, products_collection, orders_collection, offers_collection, carts_collection, reviews_collection
    
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
        offers_collection = db.offers
        carts_collection = db.carts
        reviews_collection = db.reviews
        
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
    <body style="font-family: 'Poppins', Arial, sans-serif; line-height: 1.6; color: #2D2D2D; max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header with Logo and Branding -->
        <div style="background: linear-gradient(135deg, #9C6F44 0%, #B88B4A 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <img src="https://i.ibb.co/N6Q46Xdk/Vintage-Men-s-Portrait-in-Brown-Tones.png" alt="Arun Karyana Store" style="width: 70px; height: 70px; border-radius: 50%; border: 3px solid white; margin-bottom: 15px;">
            <h1 style="margin: 0; font-size: 28px; font-family: 'Playfair Display', serif;">Thank You for Your Order! 🎉</h1>
            <p style="margin: 10px 0 0; font-size: 16px;">Arun Karyana Store</p>
            <p style="margin: 5px 0 0; font-size: 12px; opacity: 0.9;">Railway Road, Barara, Ambala, Haryana</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Dear {order_data['customer_name']},</p>
            
            <p>Your order has been successfully placed and will be processed shortly.</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9C6F44;">
                <h2 style="color: #9C6F44; margin-top: 0; font-family: 'Playfair Display', serif;">Order Details</h2>
                <p><strong>Order ID:</strong> #{order_data['order_id']}</p>
                <p><strong>Order Date:</strong> {order_data['order_date']}</p>
                <p><strong>Status:</strong> <span style="color: #f59e0b;">Pending</span></p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #9C6F44; margin-top: 0; font-family: 'Playfair Display', serif;">Items Ordered</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #F8F5F0;">
                            <th style="padding: 10px; text-align: left; color: #9C6F44; font-weight: 600;">Product</th>
                            <th style="padding: 10px; text-align: center; color: #9C6F44; font-weight: 600;">Qty</th>
                            <th style="padding: 10px; text-align: right; color: #9C6F44; font-weight: 600;">Price</th>
                            <th style="padding: 10px; text-align: right; color: #9C6F44; font-weight: 600;">Total</th>
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
                        <tr style="background: #F8F5F0;">
                            <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold; font-size: 18px;">Total Amount:</td>
                            <td style="padding: 10px; text-align: right; font-weight: bold; font-size: 18px; color: #9C6F44;">₹{order_data['total_amount']}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #9C6F44; margin-top: 0; font-family: 'Playfair Display', serif;">Delivery Address</h3>
                <p style="margin: 5px 0;"><strong>{order_data['customer_name']}</strong></p>
                <p style="margin: 5px 0;">{order_data['customer_phone']}</p>
                <p style="margin: 5px 0;">{order_data['customer_address']}</p>
            </div>
            
            <div style="background: #F8F5F0; border-left: 4px solid #9C6F44; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #9C6F44;"><strong>📦 What's Next?</strong></p>
                <p style="margin: 10px 0 0; color: #2D2D2D;">Our team will process your order and contact you shortly for delivery confirmation.</p>
            </div>
            
            <p style="margin-top: 30px;">If you have any questions, please contact us:</p>
            <p style="margin: 5px 0;">📞 Phone: +91-XXXXXXXXXX</p>
            <p style="margin: 5px 0;">📍 Railway Road, Barara, Ambala, Haryana 133201</p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #E8C07D;">
                <img src="https://i.ibb.co/N6Q46Xdk/Vintage-Men-s-Portrait-in-Brown-Tones.png" alt="Arun Karyana Store" style="width: 50px; height: 50px; border-radius: 50%; margin: 0 auto 15px; display: block;">
                <p style="color: #9C6F44; font-size: 14px; font-weight: 600;">Thank you for shopping with Arun Karyana Store!</p>
                <p style="color: #2D2D2D; font-size: 12px; margin-top: 10px;">Serving Barara since 1977</p>
                <p style="color: #6b7280; font-size: 11px; margin-top: 10px;">Railway Road, Barara, Ambala, Haryana 133201</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(customer_email, subject, html_content)

def send_order_status_update_email(order_data, customer_email, new_status, cancellation_reason=None):
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
    <body style="font-family: 'Poppins', Arial, sans-serif; line-height: 1.6; color: #2D2D2D; max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header with Logo and Branding -->
        <div style="background: linear-gradient(135deg, #9C6F44 0%, #B88B4A 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <img src="https://i.ibb.co/N6Q46Xdk/Vintage-Men-s-Portrait-in-Brown-Tones.png" alt="Arun Karyana Store" style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid white; margin-bottom: 15px;">
            <h1 style="margin: 0; font-size: 28px; font-family: 'Playfair Display', serif;">Order Status Updated</h1>
            <p style="margin: 10px 0 0; font-size: 16px;">Arun Karyana Store</p>
            <p style="margin: 5px 0 0; font-size: 12px; opacity: 0.9;">Railway Road, Barara, Ambala</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Dear {order_data['customer_name']},</p>
            
            <div style="background: white; padding: 25px; border-radius: 8px; margin: 20px 0; text-align: center; border-left: 4px solid #9C6F44;">
                <p style="font-size: 24px; margin: 0; color: #9C6F44; font-weight: bold; font-family: 'Playfair Display', serif;">{status_message}</p>
            </div>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #9C6F44;">
                <h2 style="color: #9C6F44; margin-top: 0; font-family: 'Playfair Display', serif;">Order Details</h2>
                <p><strong>Order ID:</strong> #{order_data['order_id']}</p>
                <p><strong>Total Amount:</strong> <span style="color: #9C6F44; font-weight: bold;">₹{order_data['total_amount']}</span></p>
                <p><strong>Current Status:</strong> <span style="color: #9C6F44; font-weight: bold;">{new_status}</span></p>
            </div>
            
            {'<div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;"><h3 style="color: #856404; margin-top: 0; font-family: \'Playfair Display\', serif;"><i class="fas fa-info-circle"></i> Cancellation Reason</h3><p style="color: #856404; margin: 0;">' + str(cancellation_reason) + '</p></div>' if cancellation_reason else ''}
            
            <p style="margin-top: 30px;">If you have any questions, please contact us:</p>
            <p style="margin: 5px 0;">📞 Phone: +91-XXXXXXXXXX</p>
            <p style="margin: 5px 0;">📍 Railway Road, Barara, Ambala, Haryana 133201</p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #E8C07D;">
                <img src="https://i.ibb.co/N6Q46Xdk/Vintage-Men-s-Portrait-in-Brown-Tones.png" alt="Arun Karyana Store" style="width: 50px; height: 50px; border-radius: 50%; margin: 0 auto 15px; display: block;">
                <p style="color: #9C6F44; font-size: 14px; font-weight: 600;">Thank you for shopping with Arun Karyana Store!</p>
                <p style="color: #2D2D2D; font-size: 12px; margin-top: 10px;">Serving Barara since 1977</p>
                <p style="color: #6b7280; font-size: 11px; margin-top: 10px;">Railway Road, Barara, Ambala, Haryana 133201</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(customer_email, subject, html_content)

def send_password_reset_email(user, reset_url):
    """Send password reset email with secure token link"""
    subject = "Reset Your Password - Arun Karyana Store"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <!-- Header with Logo and Branding -->
        <div style="background: linear-gradient(135deg, #9C6F44 0%, #B88B4A 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <img src="https://i.ibb.co/N6Q46Xdk/Vintage-Men-s-Portrait-in-Brown-Tones.png" alt="Arun Karyana Store" style="width: 60px; height: 60px; border-radius: 50%; border: 3px solid white; margin-bottom: 15px;">
            <h1 style="margin: 0; font-size: 28px; font-family: 'Playfair Display', serif;">🔒 Password Reset</h1>
            <p style="margin: 10px 0 0; font-size: 16px; font-family: 'Poppins', sans-serif;">Arun Karyana Store</p>
            <p style="margin: 5px 0 0; font-size: 12px; opacity: 0.9;">Railway Road, Barara, Ambala</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px;">Dear {user.get('name', 'Customer')},</p>
            
            <p>We received a request to reset your password for your Arun Karyana Store account.</p>
            
            <div style="background: white; padding: 25px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p style="margin-bottom: 20px; color: #6b7280;">Click the button below to reset your password:</p>
                <a href="{reset_url}" style="display: inline-block; background: linear-gradient(135deg, #9C6F44 0%, #B88B4A 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(156, 111, 68, 0.3);">Reset Password</a>
            </div>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                    ⚠️ <strong>Security Notice:</strong> This link will expire in 1 hour. If you didn't request this reset, please ignore this email.
                </p>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 25px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="{reset_url}" style="color: #9C6F44; word-break: break-all;">{reset_url}</a>
            </p>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 14px;">Need help? Contact us:</p>
                <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">📞 Phone: +91-XXXXXXXXXX</p>
                <p style="margin: 5px 0; color: #6b7280; font-size: 14px;">📍 Railway Road, Barara, Ambala, Haryana 133201</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    plain_content = f"""
    Password Reset Request - Arun Karyana Store
    
    Dear {user.get('name', 'Customer')},
    
    We received a request to reset your password. Click the link below to reset your password:
    
    {reset_url}
    
    This link will expire in 1 hour.
    
    If you didn't request this reset, please ignore this email.
    
    Thank you,
    Arun Karyana Store Team
    """
    
    return send_email(user['email'], subject, html_content, plain_content)

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

# Forgot Password - Request Reset
@app.route('/forgot-password', methods=['POST'])
@limiter.limit("3 per hour")  # Strict rate limit for security
def forgot_password():
    """Generate password reset token and send email"""
    try:
        if users_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data provided."}), 400
        
        email = data.get('email', '').strip().lower()
        
        if not email:
            return jsonify({"success": False, "message": "Email is required."}), 400
        
        # Validate email format
        if not validate_email(email):
            return jsonify({"success": False, "message": "Invalid email format."}), 400
        
        # Find user by email
        user = users_collection.find_one({"email": email})
        
        # IMPORTANT: Always return success message even if user doesn't exist
        # This prevents email enumeration attacks
        if not user:
            logger.info(f"⚠️ Password reset requested for non-existent email: {email}")
            return jsonify({
                "success": True,
                "message": "If an account with that email exists, you will receive a password reset link shortly."
            }), 200
        
        # Generate secure random token
        reset_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(reset_token.encode()).hexdigest()
        
        # Store token with 1-hour expiry
        expiry_time = datetime.datetime.utcnow() + datetime.timedelta(hours=1)
        users_collection.update_one(
            {"_id": user['_id']},
            {
                "$set": {
                    "reset_token": token_hash,
                    "reset_token_expiry": expiry_time
                }
            }
        )
        
        # Send reset email (use environment variable for frontend URL)
        frontend_url = os.environ.get('FRONTEND_URL', 'https://arun-karyana.netlify.app')
        # Remove trailing slash if present
        frontend_url = frontend_url.rstrip('/')
        reset_url = f"{frontend_url}/reset-password.html?token={reset_token}"
        
        try:
            send_password_reset_email(user, reset_url)
            logger.info(f"✅ Password reset email sent to: {email}")
        except Exception as email_error:
            logger.error(f"❌ Failed to send reset email: {email_error}")
            # Continue even if email fails - user won't know if email exists
        
        return jsonify({
            "success": True,
            "message": "If an account with that email exists, you will receive a password reset link shortly."
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Forgot password error: {e}")
        return jsonify({"success": False, "message": "An error occurred. Please try again later."}), 500

# Reset Password - Validate Token and Update Password
@app.route('/reset-password', methods=['POST'])
@limiter.limit("5 per hour")
def reset_password():
    """Validate reset token and update password"""
    try:
        if users_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data provided."}), 400
        
        token = data.get('token', '').strip()
        new_password = data.get('new_password', '') or data.get('password', '')  # Accept both field names
        
        if not token or not new_password:
            return jsonify({"success": False, "message": "Token and password are required."}), 400
        
        # Validate password strength (minimum 6 characters, matching frontend)
        if len(new_password) < 6:
            return jsonify({"success": False, "message": "Password must be at least 6 characters long."}), 400
        
        # Hash the token to compare with stored hash
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        # Find user with valid token
        user = users_collection.find_one({
            "reset_token": token_hash,
            "reset_token_expiry": {"$gt": datetime.datetime.utcnow()}
        })
        
        if not user:
            logger.warning(f"⚠️ Invalid or expired reset token attempt")
            return jsonify({
                "success": False,
                "message": "Invalid or expired reset link. Please request a new one."
            }), 400
        
        # Hash new password
        hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        
        # Update password and clear reset token
        users_collection.update_one(
            {"_id": user['_id']},
            {
                "$set": {"password": hashed_password},
                "$unset": {"reset_token": "", "reset_token_expiry": ""}
            }
        )
        
        logger.info(f"✅ Password reset successful for user: {user.get('email')}")
        return jsonify({
            "success": True,
            "message": "Password reset successful! You can now login with your new password."
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Reset password error: {e}")
        return jsonify({"success": False, "message": "An error occurred. Please try again later."}), 500

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
            "role": user_document.get('role', 'customer'),
            "addresses": user_document.get('addresses', []),
            "default_address_id": user_document.get('default_address_id', None)
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

# Add Address to Profile
@app.route('/profile/address/add', methods=['POST'])
@limiter.limit("20 per minute")
def add_address():
    """Add a new address to user profile"""
    try:
        if users_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        data = request.get_json()
        if not data or 'user_id' not in data:
            return jsonify({"success": False, "message": "Missing user ID."}), 400
        
        user_id = data['user_id']
        
        # Validate required address fields
        required_fields = ['label', 'full_address', 'city', 'state', 'pincode']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({"success": False, "message": f"Missing required field: {field}"}), 400
        
        # Create address object
        address = {
            "address_id": str(ObjectId()),  # Generate unique ID for address
            "label": sanitize_string(data['label']),  # e.g., "Home", "Office", "Other"
            "full_address": sanitize_string(data['full_address']),
            "city": sanitize_string(data['city']),
            "state": sanitize_string(data['state']),
            "pincode": data['pincode'].strip(),
            "phone": data.get('phone', '').strip(),
            "created_at": datetime.datetime.utcnow()
        }
        
        # Get user's current addresses
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"success": False, "message": "User not found."}), 404
        
        # Add address to user's addresses array
        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$push": {"addresses": address}}
        )
        
        # If this is the first address, set it as default
        if not user.get('addresses'):
            users_collection.update_one(
                {"_id": ObjectId(user_id)},
                {"$set": {"default_address_id": address['address_id']}}
            )
        
        logger.info(f"✅ Address added for user: {user_id}")
        return jsonify({"success": True, "message": "Address added successfully!", "address_id": address['address_id']}), 200
        
    except Exception as e:
        logger.error(f"❌ Error adding address: {e}")
        return jsonify({"success": False, "message": "An error occurred while adding the address."}), 500

# Update Address
@app.route('/profile/address/update', methods=['POST'])
@limiter.limit("20 per minute")
def update_address():
    """Update an existing address"""
    try:
        if users_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        data = request.get_json()
        if not data or 'user_id' not in data or 'address_id' not in data:
            return jsonify({"success": False, "message": "Missing user ID or address ID."}), 400
        
        user_id = data['user_id']
        address_id = data['address_id']
        
        # Build update fields
        update_fields = {}
        if 'label' in data:
            update_fields['addresses.$.label'] = sanitize_string(data['label'])
        if 'full_address' in data:
            update_fields['addresses.$.full_address'] = sanitize_string(data['full_address'])
        if 'city' in data:
            update_fields['addresses.$.city'] = sanitize_string(data['city'])
        if 'state' in data:
            update_fields['addresses.$.state'] = sanitize_string(data['state'])
        if 'pincode' in data:
            update_fields['addresses.$.pincode'] = data['pincode'].strip()
        if 'phone' in data:
            update_fields['addresses.$.phone'] = data['phone'].strip()
        
        if not update_fields:
            return jsonify({"success": False, "message": "No fields to update."}), 400
        
        # Update the specific address in the array
        result = users_collection.update_one(
            {"_id": ObjectId(user_id), "addresses.address_id": address_id},
            {"$set": update_fields}
        )
        
        if result.matched_count > 0:
            logger.info(f"✅ Address updated for user: {user_id}")
            return jsonify({"success": True, "message": "Address updated successfully!"}), 200
        else:
            return jsonify({"success": False, "message": "Address not found."}), 404
            
    except Exception as e:
        logger.error(f"❌ Error updating address: {e}")
        return jsonify({"success": False, "message": "An error occurred while updating the address."}), 500

# Delete Address
@app.route('/profile/address/delete', methods=['POST'])
@limiter.limit("20 per minute")
def delete_address():
    """Delete an address from user profile"""
    try:
        if users_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        data = request.get_json()
        if not data or 'user_id' not in data or 'address_id' not in data:
            return jsonify({"success": False, "message": "Missing user ID or address ID."}), 400
        
        user_id = data['user_id']
        address_id = data['address_id']
        
        # Remove the address from the array
        result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$pull": {"addresses": {"address_id": address_id}}}
        )
        
        if result.modified_count > 0:
            # If deleted address was default, set first remaining address as default
            user = users_collection.find_one({"_id": ObjectId(user_id)})
            if user.get('default_address_id') == address_id:
                if user.get('addresses') and len(user['addresses']) > 0:
                    users_collection.update_one(
                        {"_id": ObjectId(user_id)},
                        {"$set": {"default_address_id": user['addresses'][0]['address_id']}}
                    )
                else:
                    users_collection.update_one(
                        {"_id": ObjectId(user_id)},
                        {"$unset": {"default_address_id": ""}}
                    )
            
            logger.info(f"✅ Address deleted for user: {user_id}")
            return jsonify({"success": True, "message": "Address deleted successfully!"}), 200
        else:
            return jsonify({"success": False, "message": "Address not found."}), 404
            
    except Exception as e:
        logger.error(f"❌ Error deleting address: {e}")
        return jsonify({"success": False, "message": "An error occurred while deleting the address."}), 500

# Set Default Address
@app.route('/profile/address/set-default', methods=['POST'])
@limiter.limit("20 per minute")
def set_default_address():
    """Set an address as default"""
    try:
        if users_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        data = request.get_json()
        if not data or 'user_id' not in data or 'address_id' not in data:
            return jsonify({"success": False, "message": "Missing user ID or address ID."}), 400
        
        user_id = data['user_id']
        address_id = data['address_id']
        
        # Update default address
        result = users_collection.update_one(
            {"_id": ObjectId(user_id), "addresses.address_id": address_id},
            {"$set": {"default_address_id": address_id}}
        )
        
        if result.matched_count > 0:
            logger.info(f"✅ Default address set for user: {user_id}")
            return jsonify({"success": True, "message": "Default address updated!"}), 200
        else:
            return jsonify({"success": False, "message": "Address not found."}), 404
            
    except Exception as e:
        logger.error(f"❌ Error setting default address: {e}")
        return jsonify({"success": False, "message": "An error occurred."}), 500

# Submit Order Review
@app.route('/order/review/submit', methods=['POST'])
@limiter.limit("10 per minute")
def submit_order_review():
    """Submit a review for a delivered order"""
    try:
        if reviews_collection is None or orders_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data provided."}), 400
        
        # Validate required fields
        required_fields = ['order_id', 'user_id', 'rating', 'review_text']
        for field in required_fields:
            if field not in data:
                return jsonify({"success": False, "message": f"Missing required field: {field}"}), 400
        
        order_id = data['order_id']
        user_id = data['user_id']
        rating = int(data['rating'])
        review_text = sanitize_string(data['review_text'])
        
        # Validate rating (1-5)
        if rating < 1 or rating > 5:
            return jsonify({"success": False, "message": "Rating must be between 1 and 5."}), 400
        
        # Check if order exists and belongs to user
        order = orders_collection.find_one({"_id": ObjectId(order_id)})
        if not order:
            return jsonify({"success": False, "message": "Order not found."}), 404
        
        # Check if order is delivered
        if order.get('status') != 'Delivered':
            return jsonify({"success": False, "message": "You can only review delivered orders."}), 400
        
        # Check if already reviewed
        existing_review = reviews_collection.find_one({"order_id": order_id, "user_id": user_id})
        if existing_review:
            return jsonify({"success": False, "message": "You have already reviewed this order."}), 400
        
        # Get user info
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        
        # Create review
        review = {
            "order_id": order_id,
            "user_id": user_id,
            "user_name": user.get('name', 'Anonymous') if user else 'Anonymous',
            "rating": rating,
            "review_text": review_text,
            "featured": False,  # Admin can feature this later
            "created_at": datetime.datetime.utcnow()
        }
        
        # Insert review
        result = reviews_collection.insert_one(review)
        
        # Update order with review info
        orders_collection.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {"reviewed": True, "review_id": str(result.inserted_id)}}
        )
        
        logger.info(f"✅ Review submitted for order: {order_id}")
        return jsonify({"success": True, "message": "Thank you for your review!"}), 201
        
    except Exception as e:
        logger.error(f"❌ Error submitting review: {e}")
        return jsonify({"success": False, "message": "An error occurred while submitting the review."}), 500

# Get Reviews (Admin)
@app.route('/admin/reviews', methods=['GET'])
@admin_required
def get_all_reviews():
    """Get all reviews (admin only)"""
    try:
        if reviews_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        # Get all reviews sorted by date (newest first)
        reviews = list(reviews_collection.find({}).sort("created_at", -1))
        
        # Convert ObjectId to string and format dates
        for review in reviews:
            review['_id'] = str(review['_id'])
            if isinstance(review.get('created_at'), datetime.datetime):
                review['created_at'] = review['created_at'].isoformat()
        
        return jsonify({"success": True, "reviews": reviews}), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching reviews: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Feature/Unfeature Review (Admin)
@app.route('/admin/reviews/feature', methods=['POST'])
@admin_required
@limiter.limit("30 per minute")
def feature_review():
    """Feature or unfeature a review (admin only)"""
    try:
        if reviews_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        data = request.get_json()
        if not data or 'review_id' not in data or 'featured' not in data:
            return jsonify({"success": False, "message": "Missing review_id or featured status."}), 400
        
        review_id = data['review_id']
        featured = bool(data['featured'])
        
        # Update review
        result = reviews_collection.update_one(
            {"_id": ObjectId(review_id)},
            {"$set": {"featured": featured}}
        )
        
        if result.matched_count > 0:
            action = "featured" if featured else "unfeatured"
            logger.info(f"✅ Review {action}: {review_id}")
            return jsonify({"success": True, "message": f"Review {action} successfully!"}), 200
        else:
            return jsonify({"success": False, "message": "Review not found."}), 404
            
    except Exception as e:
        logger.error(f"❌ Error featuring review: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Get Featured Reviews (Public)
@app.route('/reviews/featured', methods=['GET'])
def get_featured_reviews():
    """Get featured reviews for homepage"""
    try:
        if reviews_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        # Get featured reviews with rating 4 or 5, limit to 10
        reviews = list(reviews_collection.find({
            "featured": True,
            "rating": {"$gte": 4}
        }).sort("created_at", -1).limit(10))
        
        # Convert ObjectId to string and format dates
        for review in reviews:
            review['_id'] = str(review['_id'])
            if isinstance(review.get('created_at'), datetime.datetime):
                review['created_at'] = review['created_at'].isoformat()
        
        return jsonify({"success": True, "reviews": reviews}), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching featured reviews: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

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
        
        # Count today's orders (all orders placed today)
        todays_orders = orders_collection.count_documents({
            "order_date": {"$gte": today_start, "$lt": today_end}
        })
        
        # Count today's delivered orders
        todays_delivered = orders_collection.count_documents({
            "status": "Delivered",
            "delivered_date": {"$gte": today_start, "$lt": today_end}
        })
        
        # Calculate today's sales (only count DELIVERED orders from today)
        today_pipeline = [
            {"$match": {
                "status": "Delivered",
                "delivered_date": {"$gte": today_start, "$lt": today_end}
            }},
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
            "todays_delivered": todays_delivered,
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

# ========== OFFERS/PROMOTIONS MANAGEMENT ==========

# Get All Offers (Public)
@app.route('/offers', methods=['GET'])
def get_offers():
    """Get all active offers (public endpoint)"""
    try:
        if offers_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        # Only return active offers
        offers = list(offers_collection.find({"active": True}))
        
        for offer in offers:
            offer['_id'] = str(offer['_id'])
            # Convert dates to ISO format
            if 'start_date' in offer:
                offer['start_date'] = offer['start_date'].isoformat() if isinstance(offer['start_date'], datetime.datetime) else offer['start_date']
            if 'end_date' in offer:
                offer['end_date'] = offer['end_date'].isoformat() if isinstance(offer['end_date'], datetime.datetime) else offer['end_date']
        
        return jsonify({"success": True, "offers": offers}), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching offers: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Admin: Get All Offers (Including Inactive)
@app.route('/admin/offers', methods=['GET'])
@admin_required
def get_all_offers_admin():
    """Get all offers including inactive ones (admin only)"""
    try:
        if offers_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        offers = list(offers_collection.find({}))
        
        for offer in offers:
            offer['_id'] = str(offer['_id'])
            # Convert dates to ISO format
            if 'start_date' in offer:
                offer['start_date'] = offer['start_date'].isoformat() if isinstance(offer['start_date'], datetime.datetime) else offer['start_date']
            if 'end_date' in offer:
                offer['end_date'] = offer['end_date'].isoformat() if isinstance(offer['end_date'], datetime.datetime) else offer['end_date']
            if 'created_at' in offer:
                offer['created_at'] = offer['created_at'].isoformat() if isinstance(offer['created_at'], datetime.datetime) else offer['created_at']
        
        return jsonify({"success": True, "offers": offers}), 200
        
    except Exception as e:
        logger.error(f"❌ Error fetching offers: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Admin: Add New Offer
@app.route('/admin/offers/add', methods=['POST'])
@admin_required
@limiter.limit("20 per minute")
def add_offer():
    """Add new offer (admin only)"""
    try:
        if offers_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['title', 'description', 'discount_type', 'discount_value']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({"success": False, "message": f"Missing required field: {field}"}), 400
        
        # Validate discount type
        if data['discount_type'] not in ['percentage', 'fixed']:
            return jsonify({"success": False, "message": "Invalid discount_type. Must be 'percentage' or 'fixed'."}), 400
        
        # Parse dates if provided
        start_date = None
        end_date = None
        if data.get('start_date'):
            try:
                start_date = datetime.datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
            except:
                start_date = datetime.datetime.utcnow()
        
        if data.get('end_date'):
            try:
                end_date = datetime.datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
            except:
                pass
        
        # Create offer
        new_offer = {
            "title": sanitize_string(data['title']),
            "description": sanitize_string(data['description']),
            "discount_type": data['discount_type'],
            "discount_value": float(data['discount_value']),
            "offer_type": data.get('offer_type', 'automatic'),  # 'automatic' or 'promo_code'
            "code": data.get('code', '').upper().strip() if data.get('code') else None,
            "min_purchase": float(data.get('min_purchase', 0)),
            "max_discount": float(data.get('max_discount', 0)) if data.get('max_discount') else None,
            "start_date": start_date or datetime.datetime.utcnow(),
            "end_date": end_date,
            "active": data.get('active', True),
            "image": data.get('image', ''),
            "created_at": datetime.datetime.utcnow(),
            "updated_at": datetime.datetime.utcnow()
        }
        
        result = offers_collection.insert_one(new_offer)
        
        logger.info(f"✅ Offer added: {new_offer['title']}")
        return jsonify({
            "success": True,
            "message": "Offer added successfully!",
            "offer_id": str(result.inserted_id)
        }), 201
        
    except Exception as e:
        logger.error(f"❌ Error adding offer: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Admin: Update Offer
@app.route('/admin/offers/update/<offer_id>', methods=['PUT'])
@admin_required
@limiter.limit("20 per minute")
def update_offer(offer_id):
    """Update offer (admin only)"""
    try:
        data = request.get_json()
        
        # Validate offer exists
        try:
            query = {"_id": ObjectId(offer_id)}
        except:
            return jsonify({"success": False, "message": "Invalid offer ID."}), 400
        
        # Build update fields
        update_fields = {"updated_at": datetime.datetime.utcnow()}
        
        if 'title' in data:
            update_fields['title'] = sanitize_string(data['title'])
        if 'description' in data:
            update_fields['description'] = sanitize_string(data['description'])
        if 'discount_type' in data:
            if data['discount_type'] not in ['percentage', 'fixed']:
                return jsonify({"success": False, "message": "Invalid discount_type."}), 400
            update_fields['discount_type'] = data['discount_type']
        if 'discount_value' in data:
            update_fields['discount_value'] = float(data['discount_value'])
        if 'code' in data:
            update_fields['code'] = data['code'].upper() if data['code'] else None
        if 'min_purchase' in data:
            update_fields['min_purchase'] = float(data['min_purchase'])
        if 'max_discount' in data:
            update_fields['max_discount'] = float(data['max_discount']) if data['max_discount'] else None
        if 'active' in data:
            update_fields['active'] = data['active']
        if 'image' in data:
            update_fields['image'] = data['image']
        
        # Handle dates
        if 'start_date' in data and data['start_date']:
            try:
                update_fields['start_date'] = datetime.datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
            except:
                pass
        
        if 'end_date' in data and data['end_date']:
            try:
                update_fields['end_date'] = datetime.datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
            except:
                pass
        
        result = offers_collection.update_one(query, {"$set": update_fields})
        
        if result.matched_count > 0:
            logger.info(f"✅ Offer updated: {offer_id}")
            return jsonify({"success": True, "message": "Offer updated successfully!"}), 200
        else:
            return jsonify({"success": False, "message": "Offer not found."}), 404
        
    except Exception as e:
        logger.error(f"❌ Error updating offer: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Admin: Delete Offer
@app.route('/admin/offers/delete/<offer_id>', methods=['DELETE'])
@admin_required
@limiter.limit("20 per minute")
def delete_offer(offer_id):
    """Delete offer (admin only)"""
    try:
        try:
            query = {"_id": ObjectId(offer_id)}
        except:
            return jsonify({"success": False, "message": "Invalid offer ID."}), 400
        
        result = offers_collection.delete_one(query)
        
        if result.deleted_count > 0:
            logger.info(f"✅ Offer deleted: {offer_id}")
            return jsonify({"success": True, "message": "Offer deleted successfully!"}), 200
        else:
            return jsonify({"success": False, "message": "Offer not found."}), 404
        
    except Exception as e:
        logger.error(f"❌ Error deleting offer: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# Admin: Toggle Offer Status
@app.route('/admin/offers/toggle/<offer_id>', methods=['PUT'])
@admin_required
@limiter.limit("30 per minute")
def toggle_offer_status(offer_id):
    """Toggle offer active/inactive status (admin only)"""
    try:
        try:
            query = {"_id": ObjectId(offer_id)}
        except:
            return jsonify({"success": False, "message": "Invalid offer ID."}), 400
        
        # Get current offer
        offer = offers_collection.find_one(query)
        if not offer:
            return jsonify({"success": False, "message": "Offer not found."}), 404
        
        # Toggle status
        new_status = not offer.get('active', True)
        result = offers_collection.update_one(query, {"$set": {"active": new_status, "updated_at": datetime.datetime.utcnow()}})
        
        if result.matched_count > 0:
            status_text = "activated" if new_status else "deactivated"
            logger.info(f"✅ Offer {status_text}: {offer_id}")
            return jsonify({"success": True, "message": f"Offer {status_text} successfully!", "active": new_status}), 200
        else:
            return jsonify({"success": False, "message": "Failed to update offer status."}), 500
        
    except Exception as e:
        logger.error(f"❌ Error toggling offer status: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

# ========== PROMO CODE VALIDATION & APPLICATION ==========

# Validate Promo Code
@app.route('/validate-promo-code', methods=['POST'])
@limiter.limit("20 per minute")
def validate_promo_code():
    """Validate promo code and return discount details"""
    try:
        if offers_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data provided."}), 400
        
        promo_code = data.get('code', '').upper().strip()
        cart_total = float(data.get('cart_total', 0))
        
        if not promo_code:
            return jsonify({"success": False, "message": "Please enter a promo code."}), 400
        
        if cart_total <= 0:
            return jsonify({"success": False, "message": "Cart is empty."}), 400
        
        # Find active offer with this promo code
        offer = offers_collection.find_one({
            "code": promo_code,
            "active": True,
            "offer_type": "promo_code",
            "$or": [
                {"end_date": None},
                {"end_date": {"$gte": datetime.datetime.utcnow()}}
            ]
        })
        
        if not offer:
            return jsonify({
                "success": False,
                "message": f"Invalid promo code '{promo_code}'. Please check and try again."
            }), 404
        
        # Check minimum purchase requirement
        min_purchase = offer.get('min_purchase', 0)
        if cart_total < min_purchase:
            return jsonify({
                "success": False,
                "message": f"Minimum purchase of ₹{min_purchase} required to use this promo code. Add ₹{min_purchase - cart_total} more to your cart."
            }), 400
        
        # Calculate discount
        discount_type = offer['discount_type']
        discount_value = offer['discount_value']
        max_discount = offer.get('max_discount', None)
        
        if discount_type == 'percentage':
            discount_amount = (cart_total * discount_value) / 100
            if max_discount and discount_amount > max_discount:
                discount_amount = max_discount
        else:  # fixed
            discount_amount = discount_value
        
        # Ensure discount doesn't exceed cart total
        discount_amount = min(discount_amount, cart_total)
        
        final_total = cart_total - discount_amount
        
        logger.info(f"✅ Promo code '{promo_code}' validated. Discount: ₹{discount_amount}")
        
        return jsonify({
            "success": True,
            "message": f"Promo code '{promo_code}' applied successfully!",
            "offer": {
                "_id": str(offer['_id']),
                "title": offer['title'],
                "description": offer['description'],
                "code": promo_code,
                "discount_type": discount_type,
                "discount_value": discount_value,
                "discount_amount": round(discount_amount, 2),
                "min_purchase": min_purchase,
                "max_discount": max_discount
            },
            "cart_total": cart_total,
            "discount_amount": round(discount_amount, 2),
            "final_total": round(final_total, 2)
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error validating promo code: {e}")
        return jsonify({"success": False, "message": "An error occurred. Please try again."}), 500

# Get Applicable Automatic Offers
@app.route('/get-applicable-offers', methods=['POST'])
@limiter.limit("30 per minute")
def get_applicable_offers():
    """Get all automatic offers applicable to current cart"""
    try:
        if offers_collection is None:
            return jsonify({"success": False, "message": "Database connection not available."}), 500
        
        data = request.get_json()
        cart_total = float(data.get('cart_total', 0))
        
        if cart_total <= 0:
            return jsonify({"success": True, "offers": []}), 200
        
        # Find all active automatic offers
        offers = list(offers_collection.find({
            "active": True,
            "offer_type": "automatic",
            "$or": [
                {"end_date": None},
                {"end_date": {"$gte": datetime.datetime.utcnow()}}
            ]
        }))
        
        applicable_offers = []
        best_discount = 0
        best_offer = None
        
        for offer in offers:
            min_purchase = offer.get('min_purchase', 0)
            
            # Check if cart meets minimum purchase
            if cart_total >= min_purchase:
                # Calculate discount
                discount_type = offer['discount_type']
                discount_value = offer['discount_value']
                max_discount = offer.get('max_discount', None)
                
                if discount_type == 'percentage':
                    discount_amount = (cart_total * discount_value) / 100
                    if max_discount and discount_amount > max_discount:
                        discount_amount = max_discount
                else:  # fixed
                    discount_amount = discount_value
                
                # Ensure discount doesn't exceed cart total
                discount_amount = min(discount_amount, cart_total)
                
                offer_data = {
                    "_id": str(offer['_id']),
                    "title": offer['title'],
                    "description": offer['description'],
                    "discount_type": discount_type,
                    "discount_value": discount_value,
                    "discount_amount": round(discount_amount, 2),
                    "min_purchase": min_purchase
                }
                
                applicable_offers.append(offer_data)
                
                # Track best discount
                if discount_amount > best_discount:
                    best_discount = discount_amount
                    best_offer = offer_data
        
        return jsonify({
            "success": True,
            "offers": applicable_offers,
            "best_offer": best_offer,
            "best_discount": round(best_discount, 2) if best_discount > 0 else 0
        }), 200
        
    except Exception as e:
        logger.error(f"❌ Error getting applicable offers: {e}")
        return jsonify({"success": False, "message": "An error occurred."}), 500

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
        cancellation_reason = data.get('cancellation_reason', None)  # Optional cancellation reason
        
        # Validate status
        valid_statuses = ['Pending', 'Processing', 'Out for Delivery', 'Delivered', 'Cancelled']
        if new_status not in valid_statuses:
            return jsonify({"success": False, "message": "Invalid status."}), 400
        
        # Validate cancellation reason if status is Cancelled
        if new_status == 'Cancelled' and not cancellation_reason:
            return jsonify({"success": False, "message": "Cancellation reason is required when cancelling an order."}), 400
        
        # Get order
        order = orders_collection.find_one({"_id": ObjectId(order_id)})
        
        if not order:
            return jsonify({"success": False, "message": "Order not found."}), 404
        
        # Update order status
        update_data = {
            "status": new_status,
            "updated_at": datetime.datetime.utcnow()
        }
        
        # If status is Delivered, add delivered_date for sales tracking AND deduct stock
        if new_status == "Delivered":
            update_data["delivered_date"] = datetime.datetime.utcnow()
            
            # Deduct stock for each item in the order
            if 'items' in order:
                for item in order['items']:
                    product_id = item.get('id')
                    quantity = item.get('quantity', 0)
                    
                    if product_id and quantity > 0:
                        try:
                            # Convert string ID to ObjectId
                            prod_obj_id = ObjectId(product_id)
                            
                            # Deduct stock from product
                            products_collection.update_one(
                                {"_id": prod_obj_id},
                                {"$inc": {"stock": -quantity}}  # Decrement stock
                            )
                            logger.info(f"📦 Deducted {quantity} units from product {product_id}")
                        except Exception as e:
                            logger.error(f"❌ Error deducting stock for product {product_id}: {e}")
        
        # If status is Cancelled, add cancellation reason and restore stock
        if new_status == "Cancelled":
            if cancellation_reason:
                update_data["cancellation_reason"] = cancellation_reason
            
            # Restore stock if order was already marked as delivered
            if order.get('status') == 'Delivered' and 'items' in order:
                for item in order['items']:
                    product_id = item.get('id')
                    quantity = item.get('quantity', 0)
                    
                    if product_id and quantity > 0:
                        try:
                            # Convert string ID to ObjectId
                            prod_obj_id = ObjectId(product_id)
                            
                            # Restore stock to product
                            products_collection.update_one(
                                {"_id": prod_obj_id},
                                {"$inc": {"stock": quantity}}  # Increment stock back
                            )
                            logger.info(f"♻️ Restored {quantity} units to product {product_id}")
                        except Exception as e:
                            logger.error(f"❌ Error restoring stock for product {product_id}: {e}")
        
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
                    new_status,
                    cancellation_reason
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
