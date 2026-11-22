<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Vary: Origin");

$allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
];
$origin = $_SERVER["HTTP_ORIGIN"] ?? "";

if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: " . $origin);
}

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit();
}

function respond_json($status, $data)
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

function connect_database()
{
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

    $host = getenv("SHOP_DB_HOST") ?: "localhost";
    $user = getenv("SHOP_DB_USER") ?: "root";
    $password = getenv("SHOP_DB_PASSWORD") ?: "";
    $database = getenv("SHOP_DB_NAME") ?: "shop_db";

    $connection = new mysqli($host, $user, $password, $database);
    $connection->set_charset("utf8mb4");

    return $connection;
}
