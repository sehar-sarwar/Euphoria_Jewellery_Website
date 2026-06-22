<?php

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── DATABASE CONFIGURATION ─────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'euphoriaa');
define('DB_USER', 'root');          // Change to your DB user
define('DB_PASS', '');              // Change to your DB password
define('DB_CHARSET', 'utf8mb4');

// ─── PDO CONNECTION ──────────────────────────
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf(
            'mysql:host=%s;dbname=%s;charset=%s',
            DB_HOST, DB_NAME, DB_CHARSET
        );
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

// ─── HELPERS ─────────────────────────────────
function respond(bool $success, string $message = '', array $data = []): void {
    echo json_encode(array_merge(['success' => $success, 'message' => $message], $data));
    exit;
}

function getBody(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function sanitize(string $str): string {
    return htmlspecialchars(strip_tags(trim($str)), ENT_QUOTES, 'UTF-8');
}

function validateEmail(string $email): bool {
    return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}

// ─── RATE LIMITING (simple session-based) ────
session_start();
$_SESSION['api_calls'] = ($_SESSION['api_calls'] ?? 0) + 1;
if ($_SESSION['api_calls'] > 120) {
    http_response_code(429);
    respond(false, 'Too many requests. Please wait a moment.');
}

// ─── ROUTER ──────────────────────────────────
$body   = getBody();
$action = sanitize($body['action'] ?? $_GET['action'] ?? '');

try {
    switch ($action) {
        case 'register': handleRegister($body); break;
        case 'login':    handleLogin($body);    break;
        case 'order':    handleOrder($body);    break;
        case 'products': handleProducts();      break;
        default:
            http_response_code(400);
            respond(false, 'Unknown action.');
    }
} catch (PDOException $e) {
    http_response_code(500);
    respond(false, 'Database error. Please try again later.');
} catch (Throwable $e) {
    http_response_code(500);
    respond(false, 'Server error: ' . $e->getMessage());
}

// ─── REGISTER ────────────────────────────────
function handleRegister(array $body): void {
    $name     = sanitize($body['name']     ?? '');
    $email    = strtolower(trim($body['email']    ?? ''));
    $password = $body['password'] ?? '';

    if (!$name)                       respond(false, 'Name is required.');
    if (!validateEmail($email))       respond(false, 'Invalid email address.');
    if (strlen($password) < 6)        respond(false, 'Password must be at least 6 characters.');

    $db   = getDB();
    $stmt = $db->prepare('SELECT id FROM users WHERE email = ?');
    $stmt->execute([$email]);
    if ($stmt->fetch()) respond(false, 'An account with that email already exists.');

    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    $stmt = $db->prepare('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, NOW())');
    $stmt->execute([$name, $email, $hash]);
    $userId = (int) $db->lastInsertId();

    respond(true, 'Account created.', [
        'user' => ['id' => $userId, 'name' => $name, 'email' => $email],
    ]);
}

// ─── LOGIN ───────────────────────────────────
function handleLogin(array $body): void {
    $email    = strtolower(trim($body['email']    ?? ''));
    $password = $body['password'] ?? '';

    if (!validateEmail($email)) respond(false, 'Invalid email address.');
    if (!$password)             respond(false, 'Password is required.');

    $db   = getDB();
    $stmt = $db->prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        respond(false, 'Invalid email or password.');
    }

    $db->prepare('UPDATE users SET last_login = NOW() WHERE id = ?')->execute([$user['id']]);

    respond(true, 'Login successful.', [
        'user' => ['id' => $user['id'], 'name' => $user['name'], 'email' => $user['email']],
    ]);
}

// ─── PLACE ORDER ─────────────────────────────
function handleOrder(array $body): void {
    $name    = sanitize($body['name']    ?? '');
    $email   = strtolower(trim($body['email']   ?? ''));
    $address = sanitize($body['address'] ?? '');
    $card    = sanitize($body['card']    ?? '');
    $total   = (float) ($body['total']   ?? 0);
    $items   = $body['items'] ?? [];

    if (!$name)                    respond(false, 'Name is required.');
    if (!validateEmail($email))    respond(false, 'Invalid email.');
    if (!$address)                 respond(false, 'Shipping address is required.');
    if (strlen(preg_replace('/\D/','',$card)) < 12) respond(false, 'Invalid card number.');
    if (empty($items))             respond(false, 'Cart is empty.');
    if ($total <= 0)               respond(false, 'Invalid total amount.');

    $cardLast4 = substr(preg_replace('/\D/','',$card), -4);

    $db = getDB();
    $db->beginTransaction();

    try {
        $stmt = $db->prepare(
            'INSERT INTO orders (customer_name, customer_email, shipping_address, card_last4, total_amount, status, created_at)
             VALUES (?, ?, ?, ?, ?, "pending", NOW())'
        );
        $stmt->execute([$name, $email, $address, $cardLast4, $total]);
        $orderId = (int) $db->lastInsertId();

        $itemStmt = $db->prepare(
            'INSERT INTO order_items (order_id, product_id, product_title, unit_price, quantity, subtotal)
             VALUES (?, ?, ?, ?, ?, ?)'
        );

        foreach ($items as $item) {
            $productId = (int)   ($item['id']    ?? 0);
            $title     = sanitize($item['title'] ?? '');
            $price     = (float) ($item['price'] ?? 0);
            $qty       = (int)   ($item['qty']   ?? 1);

            if ($productId < 1 || $price <= 0 || $qty < 1) continue;
            $itemStmt->execute([$orderId, $productId, $title, $price, $qty, $price * $qty]);
        }

        $db->commit();
        respond(true, 'Order placed successfully.', ['order_id' => $orderId]);
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
}

// ─── LIST PRODUCTS ────────────────────────────
// Returns all active products from the database, including image_url.
// The JS loadProductImages() function calls this endpoint on page load and
// patches the in-memory PRODUCTS array so images are always sourced from
// the DB. To change a product image, update the image_url column — no
// code deployment needed.
//
// Example SQL to update an image:
//   UPDATE products SET image_url = 'https://cdn.example.com/ring.jpg' WHERE id = 1;
function handleProducts(): void {
    $db   = getDB();
    $stmt = $db->query(
        'SELECT id, title, category, price, description, image_url, badge, rating, review_count
         FROM products
         WHERE is_active = 1
         ORDER BY id ASC'
    );
    $products = $stmt->fetchAll();

    // Cast types so JSON output matches the JS PRODUCTS schema exactly
    foreach ($products as &$p) {
        $p['id']           = (int)   $p['id'];
        $p['price']        = (float) $p['price'];
        $p['rating']       = (float) $p['rating'];
        $p['review_count'] = (int)   $p['review_count'];
        // image_url is the authoritative field; keep it as-is (string or null)
    }
    unset($p);

    respond(true, '', ['products' => $products]);
}