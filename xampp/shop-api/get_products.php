<?php
require_once __DIR__ . "/db.php";

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    respond_json(405, ["error" => "Method not allowed"]);
}

try {
    $connection = connect_database();
    $result = $connection->query(
        "SELECT id, name, price, image, description FROM products ORDER BY id"
    );
    $products = [];

    while ($row = $result->fetch_assoc()) {
        $products[] = [
            "id" => (int) $row["id"],
            "name" => $row["name"],
            "price" => (float) $row["price"],
            "image" => $row["image"],
            "description" => $row["description"],
        ];
    }

    $connection->close();
    respond_json(200, $products);
} catch (Throwable $error) {
    error_log($error->getMessage());
    respond_json(500, ["error" => "Products could not be loaded."]);
}
