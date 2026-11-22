<?php
require_once __DIR__ . "/db.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond_json(405, ["error" => "Method not allowed"]);
}

$data = json_decode(file_get_contents("php://input"), true);
if (!is_array($data) || !isset($data["items"]) || !is_array($data["items"]) || count($data["items"]) === 0) {
    respond_json(400, ["error" => "Your cart is empty."]);
}

$customerData = $data["customer"] ?? null;
if (!is_array($customerData)) {
    respond_json(400, ["error" => "Please provide your customer information."]);
}

$customer = [];
$requiredFields = [
    "first_name" => ["firstName", "First name", 100],
    "last_name" => ["lastName", "Last name", 100],
    "email" => ["email", "Email address", 254],
    "phone" => ["phone", "Phone number", 20],
    "address" => ["address", "Address", 500],
];

foreach ($requiredFields as $field => [$inputKey, $label, $maxLength]) {
    $value = $customerData[$inputKey] ?? null;
    if (!is_string($value) || trim($value) === "") {
        respond_json(400, ["error" => $label . " is required."]);
    }

    $value = trim($value);
    if (strlen($value) > $maxLength) {
        respond_json(400, ["error" => $label . " is too long."]);
    }

    $customer[$field] = $value;
}

if (!filter_var($customer["email"], FILTER_VALIDATE_EMAIL)) {
    respond_json(400, ["error" => "Enter a valid email address."]);
}

$phoneDigits = preg_replace("/\D/", "", $customer["phone"]);
if (!preg_match("/^[0-9+().\s-]{7,20}$/", $customer["phone"]) || strlen($phoneDigits) < 7 || strlen($phoneDigits) > 15) {
    respond_json(400, ["error" => "Enter a valid phone number."]);
}

$shippingRates = [
    "standard" => 0,
    "express" => 1000,
];
$shippingMethod = $data["shipping_method"] ?? null;
if (!is_string($shippingMethod) || !array_key_exists($shippingMethod, $shippingRates)) {
    respond_json(400, ["error" => "Choose a valid shipping method."]);
}
$shippingCostCents = $shippingRates[$shippingMethod];

$paymentMethod = $data["payment_method"] ?? null;
if ($paymentMethod !== "khqr") {
    respond_json(400, ["error" => "Choose Bakong KHQR as your payment method."]);
}

$quantities = [];
foreach ($data["items"] as $item) {
    if (!is_array($item)) {
        respond_json(400, ["error" => "The cart contains an invalid item."]);
    }

    $productId = filter_var($item["id"] ?? null, FILTER_VALIDATE_INT);
    $quantity = filter_var($item["qty"] ?? null, FILTER_VALIDATE_INT);

    if ($productId === false || $productId < 1 || $quantity === false || $quantity < 1) {
        respond_json(400, ["error" => "Product IDs and quantities must be positive whole numbers."]);
    }

    $quantities[$productId] = ($quantities[$productId] ?? 0) + $quantity;
}

$connection = null;
try {
    $connection = connect_database();
    $connection->begin_transaction();

    $firstName = $customer["first_name"];
    $lastName = $customer["last_name"];
    $email = $customer["email"];
    $phone = $customer["phone"];
    $address = $customer["address"];
    $customerStatement = $connection->prepare(
        "INSERT INTO customers (first_name, last_name, email, phone, address)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            id = LAST_INSERT_ID(id),
            first_name = VALUES(first_name),
            last_name = VALUES(last_name),
            phone = VALUES(phone),
            address = VALUES(address)"
    );
    $customerStatement->bind_param(
        "sssss",
        $firstName,
        $lastName,
        $email,
        $phone,
        $address
    );
    $customerStatement->execute();
    $customerId = $connection->insert_id;
    $customerStatement->close();

    $productStatement = $connection->prepare(
        "SELECT id, name, price, image FROM products WHERE id = ? FOR UPDATE"
    );
    $orderProducts = [];
    $subtotalCents = 0;

    foreach ($quantities as $productId => $quantity) {
        $productStatement->bind_param("i", $productId);
        $productStatement->execute();
        $product = $productStatement->get_result()->fetch_assoc();

        if (!$product) {
            throw new InvalidArgumentException("A requested product does not exist.");
        }

        $priceCents = (int) round((float) $product["price"] * 100);
        $lineTotalCents = $priceCents * $quantity;
        $subtotalCents += $lineTotalCents;
        $orderProducts[] = [
            "id" => (int) $product["id"],
            "name" => $product["name"],
            "image" => $product["image"],
            "price" => number_format($priceCents / 100, 2, ".", ""),
            "qty" => $quantity,
            "subtotal" => number_format($lineTotalCents / 100, 2, ".", ""),
        ];
    }

    $productStatement->close();
    $subtotal = number_format($subtotalCents / 100, 2, ".", "");
    $shippingCost = number_format($shippingCostCents / 100, 2, ".", "");
    $grandTotal = number_format(($subtotalCents + $shippingCostCents) / 100, 2, ".", "");
    $orderStatement = $connection->prepare(
        "INSERT INTO orders (
            customer_id, shipping_method, payment_method, shipping_cost, subtotal, grand_total
         ) VALUES (?, ?, ?, ?, ?, ?)"
    );
    $orderStatement->bind_param(
        "isssss",
        $customerId,
        $shippingMethod,
        $paymentMethod,
        $shippingCost,
        $subtotal,
        $grandTotal
    );
    $orderStatement->execute();
    $orderId = $connection->insert_id;
    $orderStatement->close();

    $itemStatement = $connection->prepare(
        "INSERT INTO order_items (order_id, product_id, product_name, price, qty, subtotal)
         VALUES (?, ?, ?, ?, ?, ?)"
    );

    foreach ($orderProducts as $product) {
        $productId = $product["id"];
        $productName = $product["name"];
        $productPrice = $product["price"];
        $productQty = $product["qty"];
        $productSubtotal = $product["subtotal"];
        $itemStatement->bind_param(
            "iisdid",
            $orderId,
            $productId,
            $productName,
            $productPrice,
            $productQty,
            $productSubtotal
        );
        $itemStatement->execute();
    }

    $itemStatement->close();

    $orderInfoStatement = $connection->prepare(
        "SELECT status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS order_date
         FROM orders WHERE id = ?"
    );
    $orderInfoStatement->bind_param("i", $orderId);
    $orderInfoStatement->execute();
    $orderInfo = $orderInfoStatement->get_result()->fetch_assoc();
    $orderInfoStatement->close();

    $connection->commit();
    $connection->close();

    respond_json(200, [
        "success" => true,
        "order_id" => $orderId,
        "order_number" => "ORD-" . str_pad((string) $orderId, 4, "0", STR_PAD_LEFT),
        "customer_name" => $customer["first_name"] . " " . $customer["last_name"],
        "order_date" => $orderInfo["order_date"],
        "status" => $orderInfo["status"],
        "items" => $orderProducts,
        "subtotal" => (float) $subtotal,
        "shipping_cost" => (float) $shippingCost,
        "grand_total" => (float) $grandTotal,
        "shipping_method" => $shippingMethod,
        "payment_method" => "Bakong KHQR",
    ]);
} catch (InvalidArgumentException $error) {
    if ($connection instanceof mysqli) {
        $connection->rollback();
        $connection->close();
    }
    respond_json(400, ["error" => $error->getMessage()]);
} catch (Throwable $error) {
    if ($connection instanceof mysqli) {
        $connection->rollback();
        $connection->close();
    }
    error_log($error->getMessage());
    respond_json(500, ["error" => "Checkout could not be completed. Please try again."]);
}
