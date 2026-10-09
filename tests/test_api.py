"""Backend API tests. They run the real Flask app against an in-memory MongoDB (mongomock).

    pip install -r requirements.txt -r requirements-dev.txt
    pytest -q
"""
import importlib
import os
import sys

import bcrypt
import mongomock
import pymongo
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.pop('JWT_SECRET_KEY', None)
os.environ['MONGO_URI'] = 'mongodb://test/'

SHARED = mongomock.MongoClient()
pymongo.MongoClient = lambda *args, **kwargs: SHARED

OWNER_TEST_PASSWORD = 'owner-test-password'


@pytest.fixture()
def app_module():
    SHARED.drop_database('arun_karyana_store_db')
    import main
    main = importlib.reload(main)
    # Use a known starting password for the owner bootstrap in tests.
    main.OWNER_PASSWORD_HASH = bcrypt.hashpw(OWNER_TEST_PASSWORD.encode(), bcrypt.gensalt(4)).decode()
    main.settings_collection.delete_many({'_id': 'owner_bootstrap'})
    main.users_collection.delete_many({'email': main.OWNER_LOGIN_EMAIL})
    main.ensure_owner_account()
    return main


@pytest.fixture()
def client(app_module):
    return app_module.app.test_client()


def login(client, who, password):
    return client.post('/login', json={'email_phone': who, 'password': password})


def owner_headers(client, app_module):
    token = login(client, app_module.OWNER_LOGIN_EMAIL, OWNER_TEST_PASSWORD).get_json()['token']
    return {'Authorization': 'Bearer ' + token}


def register(client, name='Asha', email='asha@example.com', phone='9876543210', password='asha-pass-1'):
    return client.post('/register', json={'name': name, 'email': email, 'phone': phone,
                                          'password': password, 'confirm_password': password})


def test_health_reports_versions(client):
    body = client.get('/health').get_json()
    assert body['api_version'] == 3
    assert body['owner_login_ready'] is True
    assert body['login_key'] == 'database'


def test_owner_can_log_in_and_open_dashboard(client, app_module):
    response = login(client, app_module.OWNER_LOGIN_EMAIL.upper(), OWNER_TEST_PASSWORD)
    assert response.status_code == 200
    assert response.get_json()['role'] == 'admin'
    assert client.get('/admin/dashboard/stats', headers=owner_headers(client, app_module)).status_code == 200


def test_login_key_survives_restart(client, app_module):
    headers = owner_headers(client, app_module)
    import main
    reloaded = importlib.reload(main)
    assert reloaded.app.test_client().get('/admin/dashboard/stats', headers=headers).status_code == 200


def test_changed_owner_password_is_not_reverted(client, app_module):
    headers = owner_headers(client, app_module)
    response = client.post('/account/change-password', headers=headers,
                           json={'current_password': OWNER_TEST_PASSWORD, 'new_password': 'brand-new-pass'})
    assert response.status_code == 200
    app_module.ensure_owner_account()
    assert login(client, app_module.OWNER_LOGIN_EMAIL, 'brand-new-pass').status_code == 200
    assert login(client, app_module.OWNER_LOGIN_EMAIL, OWNER_TEST_PASSWORD).status_code == 401


def test_customer_login_by_email_or_phone(client):
    assert register(client).status_code == 201
    for who in ('asha@example.com', 'ASHA@example.com', '9876543210', '+91 98765 43210', '09876543210'):
        assert login(client, who, 'asha-pass-1').status_code == 200, who
    assert login(client, 'asha@example.com', 'wrong').status_code == 401


def test_legacy_plain_text_password_is_upgraded(client, app_module):
    app_module.users_collection.insert_one({'email': 'old@example.com', 'password': 'plain-old-1', 'role': 'customer'})
    assert login(client, 'old@example.com', 'plain-old-1').status_code == 200
    stored = app_module.users_collection.find_one({'email': 'old@example.com'})['password']
    assert isinstance(stored, (bytes, bytearray)) and stored.startswith(b'$2')


def test_admin_can_reset_customer_password_and_grant_access(client, app_module):
    register(client)
    customer = app_module.users_collection.find_one({'email': 'asha@example.com'})
    headers = owner_headers(client, app_module)
    customer_token = login(client, 'asha@example.com', 'asha-pass-1').get_json()['token']
    url = f"/admin/users/{customer['_id']}/reset-password"
    assert client.post(url, headers={'Authorization': 'Bearer ' + customer_token}).status_code == 403
    temporary = client.post(url, headers=headers).get_json()['temporary_password']
    assert login(client, 'asha@example.com', temporary).status_code == 200
    assert client.post(f"/admin/users/{customer['_id']}/role", headers=headers, json={'role': 'admin'}).status_code == 200
    users = client.get('/admin/users', headers=headers).get_json()['users']
    assert all('password' not in u for u in users)


def test_forgot_password_reports_missing_email_service(client):
    register(client)
    body = client.post('/forgot-password', json={'email': 'asha@example.com'}).get_json()
    assert body['success'] is True and body['email_enabled'] is False


def test_order_is_priced_on_the_server(client, app_module):
    app_module.products_collection.insert_one({'_id': 501, 'name': 'Toor Dal 1kg', 'price': 168, 'category': 'dal', 'stock': 10})
    response = client.post('/submit-order', json={
        'customer': {'name': 'Asha', 'phone': '9876543210', 'address': 'Railway Road, Barara'},
        'items': [{'id': 501, 'name': 'Toor Dal 1kg', 'price': 1, 'quantity': 2}],
        'total': 2,
    })
    assert response.status_code == 201
    order = app_module.orders_collection.find_one({})
    assert order['total_amount'] == 168 * 2 + 40  # below free-delivery threshold


def test_protected_routes_need_a_token(client, app_module):
    assert client.get('/admin/orders').status_code == 401
    register(client)
    customer = app_module.users_collection.find_one({'email': 'asha@example.com'})
    assert client.get(f"/profile/{customer['_id']}").status_code == 401


def test_owner_login_never_gets_email_reset(client, app_module, monkeypatch):
    sent = []
    monkeypatch.setattr(app_module, 'send_password_reset_email', lambda user, url: sent.append(user))
    assert client.post('/forgot-password', json={'email': app_module.OWNER_LOGIN_EMAIL}).status_code == 200
    assert sent == []
    owner = app_module.users_collection.find_one({'email': app_module.OWNER_LOGIN_EMAIL})
    assert 'reset_token' not in owner


def test_expired_offers_are_hidden(client, app_module):
    import datetime
    now = datetime.datetime.utcnow()
    app_module.offers_collection.insert_many([
        {'title': 'Old', 'active': True, 'end_date': now - datetime.timedelta(days=3), 'offer_type': 'automatic', 'discount_type': 'fixed', 'discount_value': 50},
        {'title': 'Live', 'active': True, 'end_date': now + datetime.timedelta(days=3), 'offer_type': 'automatic', 'discount_type': 'fixed', 'discount_value': 20},
        {'title': 'Open-ended', 'active': True, 'offer_type': 'automatic', 'discount_type': 'fixed', 'discount_value': 10},
    ])
    titles = {o['title'] for o in client.get('/offers').get_json()['offers']}
    assert titles == {'Live', 'Open-ended'}


def place_order(client, app_module, quantity=2):
    app_module.products_collection.insert_one({'_id': 777, 'name': 'Moong Dal 1kg', 'price': 150, 'category': 'dal', 'stock': 10})
    response = client.post('/submit-order', json={
        'customer': {'name': 'Asha', 'phone': '9876543210', 'address': 'Railway Road, Barara'},
        'items': [{'id': 777, 'name': 'Moong Dal 1kg', 'price': 150, 'quantity': quantity}], 'total': 300,
    })
    return response.get_json()['order_id']


def test_delivering_twice_deducts_stock_once(client, app_module):
    order_id = place_order(client, app_module)
    headers = owner_headers(client, app_module)
    for _ in range(2):
        assert client.put('/admin/orders/update-status', headers=headers, json={'order_id': order_id, 'status': 'Delivered'}).status_code == 200
    assert app_module.products_collection.find_one({'_id': 777})['stock'] == 8
    client.put('/admin/orders/update-status', headers=headers, json={'order_id': order_id, 'status': 'Cancelled', 'cancellation_reason': 'test'})
    assert app_module.products_collection.find_one({'_id': 777})['stock'] == 10


def test_order_details_are_private_after_checkout_window(client, app_module):
    import datetime
    order_id = place_order(client, app_module)
    assert client.get(f'/order/{order_id}').status_code == 200  # the thank-you page right after checkout
    from bson import ObjectId
    app_module.orders_collection.update_one({'_id': ObjectId(order_id)}, {'$set': {'order_date': datetime.datetime.utcnow() - datetime.timedelta(days=2)}})
    assert client.get(f'/order/{order_id}').status_code == 403
    assert client.get(f'/order/{order_id}', headers=owner_headers(client, app_module)).status_code == 200


def test_admin_summary_counts_today_in_india(client, app_module):
    place_order(client, app_module, quantity=3)
    body = client.get('/admin/summary', headers=owner_headers(client, app_module)).get_json()
    assert body['success'] is True
    summary = body['summary']
    assert summary['today']['orders'] == 1
    assert summary['today']['revenue'] == 450 + 40  # ₹40 delivery below the ₹500 free-delivery threshold
    assert summary['series'][-1]['orders'] == 1
