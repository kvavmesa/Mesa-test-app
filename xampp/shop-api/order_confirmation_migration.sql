USE shop_db;

CREATE TABLE customers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  address VARCHAR(500) NOT NULL,
  migration_order_id INT UNSIGNED NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id INT UNSIGNED PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL DEFAULT ''
);

INSERT INTO categories (id, name, description) VALUES
  (1, 'Computers', 'Computers and laptops'),
  (2, 'Accessories', 'Input devices and accessories'),
  (3, 'Displays', 'Computer monitors and displays');

ALTER TABLE products
  ADD COLUMN category_id INT UNSIGNED NULL AFTER id;

UPDATE products
SET category_id = CASE id
  WHEN 1 THEN 1
  WHEN 2 THEN 2
  WHEN 3 THEN 2
  WHEN 4 THEN 3
  ELSE 2
END;

ALTER TABLE products
  MODIFY category_id INT UNSIGNED NOT NULL,
  ADD CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT;

ALTER TABLE orders
  ADD COLUMN customer_id INT UNSIGNED NULL AFTER id,
  ADD COLUMN payment_method VARCHAR(24) NOT NULL DEFAULT 'khqr' AFTER shipping_method,
  ADD COLUMN status ENUM('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled')
    NOT NULL DEFAULT 'Pending';

INSERT INTO customers (
  first_name, last_name, email, phone, address, migration_order_id
)
SELECT
  customer_first_name,
  customer_last_name,
  NULLIF(TRIM(email), ''),
  phone,
  address,
  id
FROM orders;

UPDATE orders AS order_row
JOIN customers AS customer_row
  ON customer_row.migration_order_id = order_row.id
SET order_row.customer_id = customer_row.id;

ALTER TABLE customers
  DROP COLUMN migration_order_id;

ALTER TABLE orders
  MODIFY customer_id INT UNSIGNED NOT NULL,
  ADD CONSTRAINT fk_orders_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  DROP COLUMN customer_first_name,
  DROP COLUMN customer_last_name,
  DROP COLUMN email,
  DROP COLUMN phone,
  DROP COLUMN address;
