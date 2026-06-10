<?php
// Configuracao compartilhada entre upload.php e download.php

// Chave de acesso. Em producao, defina via variavel de ambiente no cPanel
// (Software > Setup PHP > Options) ou hardcode aqui mesmo.
define('STORAGE_ACCESS_KEY', getenv('STORAGE_ACCESS_KEY') ?: 'TROQUE_ESTA_CHAVE_LONGA_E_ALEATORIA');

// Pasta privada, FORA do public_html.
// Ajuste para o caminho real da sua conta HostGator.
// Exemplo tipico: /home/SEU_USUARIO_CPANEL/arquivos_privados
define('STORAGE_PRIVATE_DIR', '/home/rtisol43/arquivos_privados');

// Limite de upload em bytes (10 MB)
define('STORAGE_MAX_BYTES', 10 * 1024 * 1024);

// Extensoes permitidas. Vazio = permite todas.
$STORAGE_ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'];

function storage_authenticate(): void {
    $key = $_SERVER['HTTP_X_API_KEY']
        ?? $_GET['key']
        ?? $_POST['key']
        ?? '';

    if (!is_string($key) || !hash_equals(STORAGE_ACCESS_KEY, $key)) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
}

function storage_safe_filename(string $name): string {
    $name = basename($name);
    $name = preg_replace('/[^A-Za-z0-9._-]/', '_', $name);
    return ltrim($name, '.') ?: 'arquivo';
}

// Sanitiza um caminho relativo (pasta/subpasta) preservando barras.
// Rejeita .. e segmentos vazios. Retorna null se invalido.
function storage_safe_subpath(string $path): ?string {
    $path = str_replace('\\', '/', trim($path));
    $path = trim($path, '/');
    if ($path === '') return '';

    $segments = explode('/', $path);
    $clean = [];
    foreach ($segments as $seg) {
        if ($seg === '' || $seg === '.' || $seg === '..') return null;
        $safe = preg_replace('/[^A-Za-z0-9._-]/', '_', $seg);
        $safe = ltrim($safe, '.');
        if ($safe === '') return null;
        $clean[] = $safe;
    }
    return implode('/', $clean);
}

// Resolve um caminho relativo (com pastas) dentro da area privada.
// Retorna o caminho absoluto real ou null se invalido / fora da area.
function storage_resolve_path(string $relative): ?string {
    $base = realpath(STORAGE_PRIVATE_DIR);
    if ($base === false) return null;

    $relative = str_replace('\\', '/', trim($relative));
    $relative = trim($relative, '/');
    if ($relative === '') return null;

    $parts = explode('/', $relative);
    $file = array_pop($parts);
    $file = storage_safe_filename($file);

    $dir = '';
    if (!empty($parts)) {
        $dir = storage_safe_subpath(implode('/', $parts));
        if ($dir === null) return null;
    }

    $full = $base . DIRECTORY_SEPARATOR
        . ($dir !== '' ? str_replace('/', DIRECTORY_SEPARATOR, $dir) . DIRECTORY_SEPARATOR : '')
        . $file;

    $real = realpath($full);
    if ($real === false) return null;

    if (strncmp($real, $base . DIRECTORY_SEPARATOR, strlen($base) + 1) !== 0) {
        return null;
    }
    return $real;
}
