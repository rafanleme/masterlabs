<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

storage_authenticate();

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Arquivo nao enviado ou com erro', 'code' => $_FILES['file']['error'] ?? null]);
    exit;
}

$file = $_FILES['file'];

if ($file['size'] > STORAGE_MAX_BYTES) {
    http_response_code(413);
    echo json_encode(['error' => 'Arquivo excede o limite de ' . STORAGE_MAX_BYTES . ' bytes']);
    exit;
}

$originalName = storage_safe_filename($file['name']);
$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

if (!empty($STORAGE_ALLOWED_EXTS) && !in_array($ext, $STORAGE_ALLOWED_EXTS, true)) {
    http_response_code(415);
    echo json_encode(['error' => 'Extensao nao permitida', 'ext' => $ext]);
    exit;
}

// Pasta de destino (opcional). Aceita "pasta" ou "pasta/subpasta".
$folderInput = $_POST['folder'] ?? '';
$folder = storage_safe_subpath((string) $folderInput);
if ($folder === null) {
    http_response_code(400);
    echo json_encode(['error' => 'Pasta invalida']);
    exit;
}

$targetDir = rtrim(STORAGE_PRIVATE_DIR, '/\\');
if ($folder !== '') {
    $targetDir .= DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $folder);
}

if (!is_dir($targetDir)) {
    if (!mkdir($targetDir, 0700, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Falha ao criar pasta de destino']);
        exit;
    }
}

// Nome unico para evitar colisao
$finalName = bin2hex(random_bytes(8)) . '_' . $originalName;
$destination = $targetDir . DIRECTORY_SEPARATOR . $finalName;

if (!move_uploaded_file($file['tmp_name'], $destination)) {
    http_response_code(500);
    echo json_encode(['error' => 'Falha ao salvar arquivo']);
    exit;
}

@chmod($destination, 0600);

$relativePath = ($folder !== '' ? $folder . '/' : '') . $finalName;

echo json_encode([
    'ok' => true,
    'filename' => $finalName,
    'folder' => $folder,
    'path' => $relativePath,
    'size' => filesize($destination),
]);
