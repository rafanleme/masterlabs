<?php
require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

storage_authenticate();

// Aceita caminho completo: "pasta/subpasta/arquivo.pdf" ou so "arquivo.pdf"
$relative = $_GET['path'] ?? $_GET['file'] ?? '';
if (!is_string($relative) || $relative === '') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Parametro "path" obrigatorio']);
    exit;
}

$path = storage_resolve_path($relative);
if ($path === null || !is_file($path)) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Arquivo nao encontrado']);
    exit;
}

$mime = function_exists('mime_content_type') ? mime_content_type($path) : 'application/octet-stream';
$inline = isset($_GET['inline']) && $_GET['inline'] === '1';
$disposition = $inline ? 'inline' : 'attachment';
$downloadName = basename($path);

header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($path));
header('Content-Disposition: ' . $disposition . '; filename="' . $downloadName . '"');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-store');

// Limpa qualquer buffer antes de enviar binario
while (ob_get_level() > 0) { ob_end_clean(); }

readfile($path);
