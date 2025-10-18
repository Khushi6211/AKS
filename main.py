# Import the Flask class and request/jsonify for handling requests and responses
from flask import Flask, request, jsonify
# Import MongoClient from pymongo to connect to MongoDB
from pymongo import MongoClient
# Import ObjectId from bson for working with MongoDB IDs
from bson.objectid import ObjectId
# Import os to get environment variables (good practice for sensitive info)
import os
# Import urllib.parse to safely encode username and password for the connection string
import urllib.parse
# Import pymongo to check version
import pymongo
# Import bcrypt for password hashing
import bcrypt
# Import CORS from flask_cors
from flask_cors import CORS
# Import datetime for timestamps
import datetime
# Import json_util for handling MongoDB BSON types in JSON responses
from bson import json_util
# NEW: Import 'wraps' from 'functools' for creating our security decorator
from functools import wraps

# Create an instance of the Flask class
app = Flask(__name__)

# --- Enable CORS ---
CORS(app)

# --- MongoDB Connection Setup ---
MONGO_USERNAME = os.environ.get('MONGO_USERNAME', "arunflaskuser")
MONGO_PASSWORD = os.environ.get('MONGO_PASSWORD', "Ash6211@")
MONGO_CLUSTER_URI = os.environ.get('MONGO_CLUSTER_URI', "mystorecluster.d17bljx.mongodb.net")
MONGO_PARAMS = os.environ.get('MONGO_PARAMS', "/?retryWrites=true&w=majority&appName=MyStoreCluster")

encoded_username = urllib.parse.quote_plus(MONGO_USERNAME)
encoded_password = urllib.parse.quote_plus(MONGO_PASSWORD)
mongo_uri = f"mongodb+srv://{encoded_username}:{encoded_password}@{MONGO_CLUSTER_URI}{MONGO_PARAMS}"

print("Constructed MongoDB URI for connection.")
print(f"pymongo version: {pymongo.version}")

client = None
db = None
users_collection = None
products_collection = None
orders_collection = None
carts_collection = None

try:
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
    db = client.arun_karyana_store_db
    users_collection = db.users
    products_collection = db.products
    orders_collection = db.orders
    carts_collection = db.carts
    client.admin.command('ping')
    print("Successfully connected to MongoDB!")

    if products_collection.count_documents({}) == 0:
        products_collection.insert_many([
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
        ])
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")

# ***************** NEW ADMIN SECURITY FUNCTION *****************
# This is our new "guard" function. It's a Python decorator.
# It will check if a user is an admin before allowing them to run the protected function.
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # We'll expect the frontend to send the user_id in the request headers for security checks
        user_id = request.headers.get('User-ID')
        if not user_id:
            return jsonify({"success": False, "message": "Authentication required."}), 401 # Unauthorized

        try:
            # Check the user's role in the database
            user = users_collection.find_one({"_id": ObjectId(user_id)})
            if not user or user.get('role') != 'admin':
                return jsonify({"success": False, "message": "Admin access required."}), 403 # Forbidden
        except Exception as e:
            return jsonify({"success": False, "message": "Invalid User ID or server error."}), 401

        # If the user is an admin, proceed with the original function (e.g., get_all_users)
        return f(*args, **kwargs)
    return decorated_function
# ***************************************************************

@app.route('/')
def hello_world():
    return 'Hello, Arun Karyana Store Backend!'

@app.route('/register', methods=['POST'])
def register_user():
    if 'db' not in globals() or db is None or users_collection is None:
        return jsonify({"success": False, "message": "Database connection not available."}), 500
    data = request.get_json()
    required_fields = ['name', 'email', 'phone', 'password', 'confirm_password']
    for field in required_fields:
        if field not in data or not data[field]:
            return jsonify({"success": False, "message": f"Missing required field: {field}"}), 400
    if data['password'] != data['confirm_password']:
        return jsonify({"success": False, "message": "Password and Confirm Password do not match."}), 400
    if len(data['password']) < 6:
        return jsonify({"success": False, "message": "Password must be at least 6 characters long."}), 400
    try:
        existing_user = users_collection.find_one({"$or": [{"email": data['email']}, {"phone": data['phone']}]})
        if existing_user:
            return jsonify({"success": False, "message": "User with this email or phone number already exists."}), 409
    except Exception as e:
        print(f"Error checking for existing user: {e}")
        return jsonify({"success": False, "message": "An error occurred while checking for existing user."}), 500
    try:
        hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())
    except Exception as e:
        print(f"Error hashing password: {e}")
        return jsonify({"success": False, "message": "An error occurred while processing password."}), 500
    try:
        new_user = {
            "name": data['name'],
            "email": data['email'],
            "phone": data['phone'],
            "password": hashed_password,
            "created_at": datetime.datetime.utcnow(),
            "role": "customer" # All new users are 'customer' by default
        }
        inserted_user = users_collection.insert_one(new_user)
        carts_collection.insert_one({"user_id": str(inserted_user.inserted_id), "items": []})
        if inserted_user.inserted_id:
            print(f"User registered successfully with ID: {inserted_user.inserted_id}")
            return jsonify({"success": True, "message": "Registration successful!"}), 201
        else:
            print("Error: Failed to insert user document into MongoDB.")
            return jsonify({"success": False, "message": "Failed to register user."}), 500
    except Exception as e:
        print(f"Error saving user to MongoDB: {e}")
        return jsonify({"success": False, "message": "An error occurred while saving user data."}), 500

@app.route('/login', methods=['POST'])
def login_user():
    if 'db' not in globals() or db is None or users_collection is None:
       return jsonify({"success": False, "message": "Database connection not available."}), 500
    data = request.get_json()
    required_fields = ['email_phone', 'password']
    for field in required_fields:
        if field not in data or not data[field]:
            return jsonify({"success": False, "message": f"Missing required field: {field}"}), 400
    try:
        user = users_collection.find_one({"$or": [{"email": data['email_phone']}, {"phone": data['email_phone']}]})
    except Exception as e:
        print(f"Error finding user during login: {e}")
        return jsonify({"success": False, "message": "An error occurred during login."}), 500
    if user and bcrypt.checkpw(data['password'].encode('utf-8'), user['password']):
        print(f"User logged in successfully: {user.get('email') or user.get('phone')}")
        return jsonify({"success": True, "message": "Login successful!", "user_id": str(user['_id'])}), 200
    else:
        print("Login failed: Invalid email/phone or password.")
        return jsonify({"success": False, "message": "Invalid email/phone or password."}), 401

@app.route('/submit-order', methods=['POST'])
def submit_order():
    if 'db' not in globals() or db is None or orders_collection is None:
        return jsonify({"success": False, "message": "Database connection not available."}), 500
    data = request.get_json()
    required_fields = ['customer', 'items', 'total']
    for field in required_fields:
        if field not in data or data[field] is None:
            return jsonify({"success": False, "message": f"Missing required field: {field}"}), 400
    customer_fields = ['name', 'phone', 'address']
    if 'customer' not in data or not isinstance(data['customer'], dict) or not all(field in data['customer'] and data['customer'][field] for field in customer_fields):
        return jsonify({"success": False, "message": "Missing or incomplete customer details."}), 400
    if not data['items'] or not isinstance(data['items'], list):
        return jsonify({"success": False, "message": "Order must contain items."}), 400
    try:
        new_order = {
            "customer_info": data['customer'],
            "items": data['items'],
            "subtotal": data.get('subtotal'),
            "delivery_fee": data.get('deliveryFee'),
            "total_amount": data['total'],
            "order_date": datetime.datetime.utcnow(),
            "status": "Pending",
            "user_id": data.get('user_id')
        }
        inserted_order = orders_collection.insert_one(new_order)
        if inserted_order.inserted_id:
            order_id_str = str(inserted_order.inserted_id)
            print(f"Order placed successfully with ID: {order_id_str}")
            return jsonify({"success": True, "message": "Order placed successfully!", "order_id": order_id_str}), 201
        else:
            print("Error: Failed to insert order document into MongoDB.")
            return jsonify({"success": False, "message": "Failed to place order."}), 500
    except Exception as e:
        print(f"Error saving order to MongoDB: {e}")
        return jsonify({"success": False, "message": "An error occurred while saving order data."}), 500

@app.route('/cart/<user_id>', methods=['GET'])
def get_cart(user_id):
    if 'db' not in globals() or db is None or carts_collection is None:
        return jsonify({"success": False, "message": "Database connection not available."}), 500
    try:
        filter_query = {"user_id": user_id}
        cart_document = carts_collection.find_one(filter_query)
        if cart_document:
            cart_items = cart_document.get('items', [])
            return jsonify({"success": True, "cart": cart_items}), 200
        else:
            return jsonify({"success": True, "cart": []}), 200
    except Exception as e:
        print(f"Error fetching cart for user {user_id}: {e}")
        return jsonify({"success": False, "message": "An error occurred while fetching the cart."}), 500

@app.route('/cart/update', methods=['POST'])
def update_cart():
    if 'db' not in globals() or db is None or carts_collection is None:
        return jsonify({"success": False, "message": "Database connection not available."}), 500
    data = request.get_json()
    required_fields = ['user_id', 'items']
    for field in required_fields:
        if field not in data or data[field] is None:
            return jsonify({"success": False, "message": f"Missing required field: {field}"}), 400
    user_id = data['user_id']
    cart_items = data['items']
    try:
        filter_query = {"user_id": user_id}
        update_result = carts_collection.update_one(
            filter_query,
            {"$set": {"items": cart_items, "last_updated": datetime.datetime.utcnow()}},
            upsert=True
        )
        if update_result.acknowledged:
            print(f"Cart updated successfully for user {user_id}.")
            return jsonify({"success": True, "message": "Cart updated successfully."}), 200
        else:
            print(f"Cart update not acknowledged for user {user_id}.")
            return jsonify({"success": False, "message": "Failed to update cart."}), 500
    except Exception as e:
        print(f"Error updating cart for user {user_id}: {e}")
        return jsonify({"success": False, "message": "An error occurred while updating the cart."}), 500

@app.route('/orders/<user_id>', methods=['GET'])
def get_user_orders(user_id):
    if 'db' not in globals() or db is None or orders_collection is None:
        return jsonify({"success": False, "message": "Database connection not available."}), 500
    try:
        filter_query = {"user_id": user_id}
        orders_cursor = orders_collection.find(filter_query).sort("order_date", -1)
        orders_list = []
        for order in orders_cursor:
            order['_id'] = str(order['_id'])
            if 'order_date' in order and isinstance(order['order_date'], datetime.datetime):
                order['order_date'] = order['order_date'].isoformat()
            if 'items' in order and isinstance(order['items'], list):
                for item in order['items']:
                    if 'id' in item:
                        try:
                            item['id'] = int(item['id'])
                        except (ValueError, TypeError):
                            pass
            orders_list.append(order)
        print(f"Found {len(orders_list)} orders for user {user_id}.")
        return jsonify({"success": True, "orders": orders_list}), 200
    except Exception as e:
        print(f"Error fetching orders for user {user_id}: {e}")
        return jsonify({"success": False, "message": "An error occurred while fetching orders."}), 500

@app.route('/profile/<user_id>', methods=['GET'])
def get_user_profile(user_id):
    if 'db' not in globals() or db is None or users_collection is None:
        return jsonify({"success": False, "message": "Database connection not available."}), 500
    try:
        user_document = users_collection.find_one({"_id": ObjectId(user_id)})
        if user_document:
            user_data = {
                "_id": str(user_document['_id']),
                "name": user_document.get('name'),
                "email": user_document.get('email'),
                "phone": user_document.get('phone'),
                "created_at": user_document.get('created_at').isoformat() if user_document.get('created_at') else None,
                "role": user_document.get('role', 'customer')
            }
            print(f"Fetched profile for user ID: {user_id}")
            return jsonify({"success": True, "user": user_data}), 200
        else:
            print(f"User not found for ID: {user_id}")
            return jsonify({"success": False, "message": "User not found."}), 404
    except Exception as e:
        print(f"Error fetching profile for user {user_id}: {e}")
        if isinstance(e, Exception) and ("ObjectId" in str(e) or "InvalidId" in str(e)):
            return jsonify({"success": False, "message": "Invalid user ID format."}), 400
        return jsonify({"success": False, "message": "An error occurred while fetching the profile."}), 500

@app.route('/profile/update', methods=['POST'])
def update_user_profile():
    if 'db' not in globals() or db is None or users_collection is None:
        return jsonify({"success": False, "message": "Database connection not available."}), 500
    data = request.get_json()
    if 'user_id' not in data or not data['user_id']:
        return jsonify({"success": False, "message": "Missing user ID."}), 400
    user_id = data['user_id']
    update_fields = {}
    if 'name' in data and data['name']:
        update_fields['name'] = data['name']
    if 'email' in data and data['email']:
        update_fields['email'] = data['email']
    if 'phone' in data and data['phone']:
        update_fields['phone'] = data['phone']
    if not update_fields:
        return jsonify({"success": False, "message": "No valid fields provided for update."}), 400
    try:
        update_result = users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_fields}
        )
        if update_result.matched_count > 0 and update_result.modified_count > 0:
            print(f"Profile updated successfully for user ID: {user_id}")
            return jsonify({"success": True, "message": "Profile updated successfully."}), 200
        elif update_result.matched_count > 0 and update_result.modified_count == 0:
            print(f"Profile matched for user ID: {user_id}, but no changes were made.")
            return jsonify({"success": True, "message": "Profile matched, but no changes were made (data was the same)."}), 200
        else:
            print(f"User not found for update with ID: {user_id}")
            return jsonify({"success": False, "message": "User not found."}), 404
    except Exception as e:
        print(f"Error updating profile for user {user_id}: {e}")
        if isinstance(e, Exception) and ("ObjectId" in str(e) or "InvalidId" in str(e)):
            return jsonify({"success": False, "message": "Invalid user ID format."}), 400
        return jsonify({"success": False, "message": "An error occurred while updating the profile."}), 500

@app.route('/order/<order_id>', methods=['GET'])
def get_order_details(order_id):
    if 'db' not in globals() or db is None or orders_collection is None:
        return jsonify({"success": False, "message": "Database connection not available."}), 500
    try:
        order_object_id = ObjectId(order_id)
        order_document = orders_collection.find_one({"_id": order_object_id})
        if order_document:
            order_document['_id'] = str(order_document['_id'])
            if 'order_date' in order_document and isinstance(order_document['order_date'], datetime.datetime):
                order_document['order_date'] = order_document['order_date'].isoformat()
            if 'items' in order_document and isinstance(order_document['items'], list):
                for item in order_document['items']:
                    if 'id' in item:
                        try:
                            item['id'] = int(item['id'])
                        except (ValueError, TypeError):
                            pass
            print(f"Fetched details for order ID: {order_id}")
            return jsonify({"success": True, "message": "Order found", "order": order_document}), 200
        else:
            print(f"Order not found for ID: {order_id}")
            return jsonify({"success": False, "message": "Order not found."}), 404
    except Exception as e:
        print(f"Error fetching order details for ID {order_id}: {e}")
        if isinstance(e, Exception) and ("ObjectId" in str(e) or "InvalidId" in str(e)):
            return jsonify({"success": False, "message": "Invalid order ID format."}), 400
        return jsonify({"success": False, "message": "An error occurred while fetching order details."}), 500

@app.route('/user_role/<user_id>', methods=['GET'])
def get_user_role(user_id):
    if 'db' not in globals() or db is None or users_collection is None:
        return jsonify({"success": False, "message": "Database connection not available."}), 500
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)}, {"role": 1})
        if user:
            role = user.get('role', 'customer')
            return jsonify({"success": True, "role": role}), 200
        else:
            return jsonify({"success": False, "message": "User not found!"}), 404
    except Exception as e:
        if isinstance(e, Exception) and ("ObjectId" in str(e) or "InvalidId" in str(e)):
            return jsonify({"success": False, "message": "Invalid user ID format."}), 400
        return jsonify({"success": False, "message": str(e)}), 500

# Apply the security decorator to the admin routes
@app.route('/admin/users', methods=['GET'])
@admin_required
def get_all_users():
    if 'db' not in globals() or db is None or users_collection is None:
        return jsonify({"success": False, "message": "Database connection not available."}), 500
    try:
        users = list(users_collection.find({}, {'password': 0}))
        for user in users:
            user['_id'] = str(user['_id'])
            if 'created_at' in user and isinstance(user['created_at'], datetime.datetime):
                user['created_at'] = user['created_at'].isoformat()
            user['role'] = user.get('role', 'customer')
        return jsonify({"success": True, "users": users}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# Apply the security decorator to the admin routes
@app.route('/admin/orders', methods=['GET'])
@admin_required
def get_all_orders():
    if 'db' not in globals() or db is None or orders_collection is None:
        return jsonify({"success": False, "message": "Database connection not available."}), 500
    try:
        orders = list(orders_collection.find({}).sort("order_date", -1))
        for order in orders:
            order['_id'] = str(order['_id'])
            if 'order_date' in order and isinstance(order['order_date'], datetime.datetime):
                order['order_date'] = order['order_date'].isoformat()
            if 'items' in order and isinstance(order['items'], list):
                for item in order['items']:
                    if 'id' in item:
                        try:
                            item['id'] = int(item['id'])
                        except (ValueError, TypeError):
                            pass
        return jsonify({"success": True, "orders": orders}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=81, debug=True)