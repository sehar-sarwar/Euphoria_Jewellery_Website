-- Create & select database
CREATE DATABASE IF NOT EXISTS euphoriaa
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE euphoriaa;

-- ─── USERS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120)     NOT NULL,
  email         VARCHAR(180)     NOT NULL,
  password_hash VARCHAR(255)     NOT NULL,
  created_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login    DATETIME                  DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── PRODUCTS ─────────────────────────────────
-- Optional: move the JS PRODUCTS array here for server-side management.
CREATE TABLE IF NOT EXISTS products (
  id          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  title       VARCHAR(200)     NOT NULL,
  category    VARCHAR(80)      NOT NULL,
  price       DECIMAL(10,2)    NOT NULL,
  description TEXT,
  image_url   VARCHAR(500)     NOT NULL DEFAULT '',
  badge       VARCHAR(60)               DEFAULT NULL,
  rating      DECIMAL(3,2)     NOT NULL DEFAULT 4.50,
  review_count INT UNSIGNED    NOT NULL DEFAULT 0,
  stock       INT UNSIGNED     NOT NULL DEFAULT 100,
  is_active   TINYINT(1)       NOT NULL DEFAULT 1,
  created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_products_category (category),
  KEY idx_products_active   (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── ORDERS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  customer_name    VARCHAR(120)     NOT NULL,
  customer_email   VARCHAR(180)     NOT NULL,
  shipping_address VARCHAR(400)     NOT NULL,
  card_last4       CHAR(4)          NOT NULL,          -- never store full card numbers
  total_amount     DECIMAL(10,2)    NOT NULL,
  status           ENUM('pending','paid','shipped','delivered','cancelled')
                                    NOT NULL DEFAULT 'pending',
  notes            TEXT                      DEFAULT NULL,
  created_at       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_orders_email  (customer_email),
  KEY idx_orders_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── ORDER ITEMS ──────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  order_id      INT UNSIGNED  NOT NULL,
  product_id    INT UNSIGNED  NOT NULL,
  product_title VARCHAR(200)  NOT NULL,
  unit_price    DECIMAL(10,2) NOT NULL,
  quantity      INT UNSIGNED  NOT NULL DEFAULT 1,
  subtotal      DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_items_order   (order_id),
  KEY idx_items_product (product_id),
  CONSTRAINT fk_items_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── WISHLIST (server-side persistence) ───────
CREATE TABLE IF NOT EXISTS wishlists (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  added_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wish (user_id, product_id),
  KEY idx_wish_user (user_id),
  CONSTRAINT fk_wish_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── SEED: DEMO USER ──────────────────────────
-- Password: password123 (bcrypt hash)
INSERT IGNORE INTO users (name, email, password_hash) VALUES
('Demo User', 'demo@euphoria.shop',
 '$2y$12$Hb5y5dDzOD/wqZ9LN2tBruQJ5EE7KbS3TNd.oAj2FcjqvOJAalVqC');

-- ─── SEED: SAMPLE PRODUCTS ────────────────────
INSERT IGNORE INTO products (id, title, category, price, description, image_url, badge, rating, review_count) VALUES
(1,  'Aurora Solitaire Ring',        'Rings',     1250.00,
     'A timeless solitaire ring featuring a brilliant-cut diamond set in 18k yellow gold.',
     'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80',
     'Bestseller', 4.90, 128),
(2,  'Celestial Pendant Necklace',   'Necklaces',  680.00,
     'A delicate 14k gold pendant featuring a hand-set natural sapphire.',
     'https://images.unsplash.com/photo-1633934542430-0905ccb5f050?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8TmVja2xhY2V8ZW58MHx8MHx8fDA%3D',
     'New', 4.70, 94),
(3,  'Pearl Drop Earrings',          'Earrings',   390.00,
     'South Sea cultured pearls on an 18k gold wire, measuring 9–10mm.',
     'https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&w=600&q=80',
     NULL, 4.80, 63),
(4,  'Gold Tennis Bracelet',         'Bracelets',  920.00,
     'Classic 18k yellow gold tennis bracelet set with 3.5 ct of round brilliant diamonds.',
     'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=600&q=80',
     'Bestseller', 4.90, 210),
(5,  'Eternal Halo Engagement Ring', 'Bridal',    3400.00,
     'A 1.5 ct cushion-cut diamond encircled by a double halo of micro-pavé diamonds, set in platinum.',
     'https://images.unsplash.com/photo-1543294001-f7cd5d 7fb516?auto=format&fit=crop&w=600&q=80',
     'Bridal', 5.00, 47),
(6,  'Layered Charm Necklace',       'Necklaces',  425.00,
     'Three delicate 14k gold chains layered to perfection with moon, star and heart charms.',
     'https://images.unsplash.com/photo-1573408301185-9519f94ae1a6?auto=format&fit=crop&w=600&q=80',
     NULL, 4.60, 75),
(7,  'Diamond Stud Earrings',        'Earrings',   760.00,
     'Classic round brilliant diamond studs totalling 1.0 ct in 18k white gold. GIA certified.',
     'https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=600&q=80',
     'Bestseller', 4.80, 183),
(8,  'Rose Gold Bangle',             'Bracelets',  310.00,
     'Sleek 14k rose gold bangle engraved with a whisper-fine floral pattern. Stackable.',
     'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=600&q=80',
     'New', 4.50, 52),
(9,  'Vintage Sapphire Ring',        'Rings',     1890.00,
     'Oval sapphire (2.5 ct) flanked by old-European cut diamonds in 18k yellow gold. Art Deco inspired.',
     'https://images.unsplash.com/photo-1581349485608-9469926a8e5e?auto=format&fit=crop&w=600&q=80',
     NULL, 4.70, 38),
(10, 'Wedding Band Set',             'Bridal',    1650.00,
     'Matching his-and-hers 18k gold wedding bands with comfort-fit interior.',
     'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80',
     'Bridal', 4.90, 91),
(11, 'Diamond Rivière Necklace',     'Necklaces', 2100.00,
     'Forty brilliants set in a graduated platinum river of light. 16" with 2" extender.',
     'https://images.unsplash.com/photo-1561828995-aa79a2db86dd?auto=format&fit=crop&w=600&q=80',
     NULL, 4.80, 29),
(12, 'Emerald Hoop Earrings',        'Earrings',   545.00,
     'Polished 18k gold hoops with channel-set natural emeralds. Lightweight statement earrings.',
     'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=600&q=80',
     'New', 4.60, 44);

-- ─── USEFUL VIEWS ─────────────────────────────
CREATE OR REPLACE VIEW v_order_summary AS
SELECT
  o.id           AS order_id,
  o.customer_name,
  o.customer_email,
  o.total_amount,
  o.status,
  o.created_at,
  COUNT(i.id)    AS item_count
FROM orders o
LEFT JOIN order_items i ON i.order_id = o.id
GROUP BY o.id;

CREATE OR REPLACE VIEW v_revenue_by_category AS
SELECT
  p.category,
  SUM(i.quantity)  AS units_sold,
  SUM(i.subtotal)  AS revenue
FROM order_items i
JOIN products p ON p.id = i.product_id
JOIN orders o   ON o.id = i.order_id
WHERE o.status NOT IN ('cancelled')
GROUP BY p.category
ORDER BY revenue DESC;