USE shop_db;

ALTER TABLE orders
  ADD COLUMN customer_first_name VARCHAR(100) NOT NULL DEFAULT '' AFTER id,
  ADD COLUMN customer_last_name VARCHAR(100) NOT NULL DEFAULT '' AFTER customer_first_name,
  ADD COLUMN email VARCHAR(254) NOT NULL DEFAULT '' AFTER customer_last_name,
  ADD COLUMN phone VARCHAR(20) NOT NULL DEFAULT '' AFTER email,
  ADD COLUMN address VARCHAR(500) NOT NULL DEFAULT '' AFTER phone,
  ADD COLUMN shipping_method VARCHAR(20) NOT NULL DEFAULT 'standard' AFTER address,
  ADD COLUMN shipping_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER shipping_method;
