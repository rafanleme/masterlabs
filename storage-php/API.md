# Storage API

API simples de armazenamento de arquivos hospedada na HostGator. Permite upload e download de arquivos em uma área privada do servidor, com autenticação por chave de acesso.

## Base URL

```
https://www.rtisolutionscode.com.br/storage
```

## Autenticação

Todas as requisições exigem a chave de acesso enviada no header:

```
X-API-Key: SUA_CHAVE_AQUI
```

Alternativamente, a chave pode ser enviada via query string (`?key=...`) ou no corpo POST (`key=...`). **Prefira o header** — query string fica em logs de acesso do servidor.

Se a chave estiver ausente ou incorreta, qualquer endpoint retorna:

```http
401 Unauthorized
Content-Type: application/json

{ "error": "Unauthorized" }
```

---

## POST /upload.php

Envia um arquivo para a área privada. Permite opcionalmente especificar uma pasta de destino.

### Request

- **Method:** `POST`
- **Content-Type:** `multipart/form-data`

| Campo    | Tipo   | Obrigatório | Descrição                                                                   |
|----------|--------|-------------|-----------------------------------------------------------------------------|
| `file`   | File   | Sim         | Arquivo binário a ser enviado                                               |
| `folder` | String | Não         | Caminho relativo da pasta de destino. Ex.: `laudos` ou `laudos/2026/06`     |

**Regras do `folder`:**
- Pode ter múltiplos níveis separados por `/`.
- Caracteres permitidos por segmento: `A-Z`, `a-z`, `0-9`, `.`, `_`, `-`. Outros viram `_`.
- `..`, segmentos vazios e caminhos absolutos são rejeitados (`400`).
- A hierarquia é criada automaticamente se não existir.
- Se omitido ou vazio, o arquivo vai para a raiz da área privada.

**Limites e restrições:**
- Tamanho máximo: **10 MB**.
- Extensões permitidas: `jpg`, `jpeg`, `png`, `gif`, `webp`, `pdf`.
- O nome final do arquivo recebe um prefixo aleatório de 16 caracteres hex para evitar colisão e enumeração.

### Response — Sucesso

```http
200 OK
Content-Type: application/json
```

```json
{
  "ok": true,
  "filename": "a1b2c3d4e5f60718_laudo.pdf",
  "folder": "laudos/2026/06",
  "path": "laudos/2026/06/a1b2c3d4e5f60718_laudo.pdf",
  "size": 245678
}
```

> ⚠️ **Importante:** guarde o valor de `path`. Ele é o identificador que você passa no download. O `filename` sozinho **não** basta se o arquivo estiver em uma subpasta.

### Response — Erros

| Status | Body                                                                | Causa                                                |
|--------|---------------------------------------------------------------------|------------------------------------------------------|
| 400    | `{ "error": "Arquivo nao enviado ou com erro", "code": N }`         | Campo `file` ausente ou erro do PHP no upload        |
| 400    | `{ "error": "Pasta invalida" }`                                     | `folder` com `..`, caracteres inválidos ou vazios    |
| 401    | `{ "error": "Unauthorized" }`                                       | Chave ausente ou incorreta                           |
| 405    | `{ "error": "Method not allowed" }`                                 | Método diferente de POST                             |
| 413    | `{ "error": "Arquivo excede o limite de 10485760 bytes" }`          | Arquivo maior que 10 MB                              |
| 415    | `{ "error": "Extensao nao permitida", "ext": "..." }`               | Extensão fora da whitelist                           |
| 500    | `{ "error": "Falha ao criar pasta de destino" }`                    | Sem permissão de escrita / disco cheio               |
| 500    | `{ "error": "Falha ao salvar arquivo" }`                            | `move_uploaded_file` falhou                          |

### Exemplo — curl

```bash
curl -X POST https://www.rtisolutionscode.com.br/storage/upload.php \
  -H "X-API-Key: SUA_CHAVE" \
  -F "file=@./laudo.pdf" \
  -F "folder=laudos/2026/06"
```

### Exemplo — Node.js (fetch + FormData)

```js
import fs from 'node:fs';

const form = new FormData();
form.append('file', new Blob([fs.readFileSync('./laudo.pdf')]), 'laudo.pdf');
form.append('folder', 'laudos/2026/06');

const res = await fetch('https://www.rtisolutionscode.com.br/storage/upload.php', {
  method: 'POST',
  headers: { 'X-API-Key': process.env.STORAGE_KEY },
  body: form,
});

const data = await res.json();
if (!res.ok) throw new Error(data.error);

console.log(data.path); // -> "laudos/2026/06/abc..._laudo.pdf"
```

### Exemplo — Node.js (axios + form-data)

```js
import axios from 'axios';
import FormData from 'form-data';
import fs from 'node:fs';

const form = new FormData();
form.append('file', fs.createReadStream('./laudo.pdf'));
form.append('folder', 'laudos/2026/06');

const { data } = await axios.post(
  'https://www.rtisolutionscode.com.br/storage/upload.php',
  form,
  {
    headers: {
      ...form.getHeaders(),
      'X-API-Key': process.env.STORAGE_KEY,
    },
  }
);
```

---

## GET /download.php

Baixa um arquivo previamente enviado. Aceita o caminho completo retornado pelo upload.

### Request

- **Method:** `GET`

| Param    | Tipo   | Obrigatório | Descrição                                                                  |
|----------|--------|-------------|----------------------------------------------------------------------------|
| `path`   | String | Sim         | Caminho relativo retornado no `path` do upload. Ex.: `laudos/2026/06/abc.pdf` |
| `inline` | `0`/`1`| Não         | `1` força `Content-Disposition: inline` (abre no browser em vez de baixar) |

> O parâmetro `file` é aceito como alias de `path` por compatibilidade, mas use `path`.

### Response — Sucesso

```http
200 OK
Content-Type: <mime do arquivo>
Content-Length: <tamanho em bytes>
Content-Disposition: attachment; filename="abc..._laudo.pdf"
X-Content-Type-Options: nosniff
Cache-Control: private, no-store

<bytes binários do arquivo>
```

### Response — Erros

| Status | Body                                          | Causa                                          |
|--------|-----------------------------------------------|------------------------------------------------|
| 400    | `{ "error": "Parametro \"path\" obrigatorio" }` | `path` ausente ou vazio                        |
| 401    | `{ "error": "Unauthorized" }`                 | Chave ausente ou incorreta                     |
| 404    | `{ "error": "Arquivo nao encontrado" }`       | Caminho inválido, traversal, ou arquivo inexistente |
| 405    | `{ "error": "Method not allowed" }`           | Método diferente de GET                        |

### Exemplo — curl

```bash
curl -OJ "https://www.rtisolutionscode.com.br/storage/download.php?path=laudos/2026/06/abc..._laudo.pdf" \
  -H "X-API-Key: SUA_CHAVE"
```

O flag `-OJ` faz o curl salvar usando o nome do `Content-Disposition`.

### Exemplo — Node.js (fetch → arquivo)

```js
import fs from 'node:fs';

const url = new URL('https://www.rtisolutionscode.com.br/storage/download.php');
url.searchParams.set('path', 'laudos/2026/06/abc..._laudo.pdf');

const res = await fetch(url, {
  headers: { 'X-API-Key': process.env.STORAGE_KEY },
});

if (!res.ok) {
  const err = await res.json();
  throw new Error(err.error);
}

const buffer = Buffer.from(await res.arrayBuffer());
fs.writeFileSync('./baixado.pdf', buffer);
```

### Exemplo — Node.js (stream para arquivo)

```js
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const res = await fetch(url, { headers: { 'X-API-Key': process.env.STORAGE_KEY } });
if (!res.ok) throw new Error(`HTTP ${res.status}`);

await pipeline(Readable.fromWeb(res.body), fs.createWriteStream('./baixado.pdf'));
```

### Exemplo — Browser (abrir/baixar via link)

Como a chave precisa ir no header, o uso direto via `<a href>` exige passar a chave na query string (menos seguro). Para abrir/exibir no browser sem expor a chave, faça o seu backend baixar o arquivo da Storage API e re-servir para o cliente.

```html
<!-- Funciona, mas vaza a chave na URL/logs. Use só em contextos internos. -->
<a href="https://www.rtisolutionscode.com.br/storage/download.php?path=laudos/2026/06/abc.pdf&key=CHAVE&inline=1" target="_blank">
  Ver laudo
</a>
```

---

## Boas práticas para integração

1. **Guarde o `path` no seu banco.** É o identificador estável do arquivo. Não tente reconstruir o nome a partir do upload original — o prefixo aleatório é parte do nome final.

2. **Use sempre HTTPS.** A chave vai em texto claro no header — só TLS protege.

3. **Mantenha a chave fora do código versionado.** Use variável de ambiente (`process.env.STORAGE_KEY`).

4. **Pense em uma convenção de pastas.** Sugestões:
   - Por entidade: `laudos/<id_laudo>/`
   - Por data: `uploads/<ano>/<mes>/`
   - Por tenant: `tenant-<id>/<tipo>/`

5. **Trate o 404 como "arquivo deletado ou path inválido"** — a API não distingue para não vazar existência de arquivos.

6. **Não confie no `Content-Type` do servidor para arquivos sensíveis.** Re-valide o mime no seu backend antes de servir ao usuário final.

7. **Não há listagem ou exclusão pela API.** Para gerenciar arquivos antigos, use SSH/cPanel ou estenda a API.

---

## Cliente Node.js sugerido (helper completo)

```js
// storage-client.js
import axios from 'axios';
import FormData from 'form-data';
import fs from 'node:fs';

const BASE_URL = 'https://www.rtisolutionscode.com.br/storage';
const KEY = process.env.STORAGE_KEY;

if (!KEY) throw new Error('STORAGE_KEY nao configurada');

const http = axios.create({
  baseURL: BASE_URL,
  headers: { 'X-API-Key': KEY },
  timeout: 30_000,
});

export async function uploadFile({ filePath, folder = '', filename }) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), filename);
  if (folder) form.append('folder', folder);

  const { data } = await http.post('/upload.php', form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return data; // { ok, filename, folder, path, size }
}

export async function downloadFile(path) {
  const { data } = await http.get('/download.php', {
    params: { path },
    responseType: 'arraybuffer',
  });
  return Buffer.from(data);
}

export async function downloadToFile(path, destPath) {
  const { data } = await http.get('/download.php', {
    params: { path },
    responseType: 'stream',
  });
  await new Promise((resolve, reject) => {
    const w = fs.createWriteStream(destPath);
    data.pipe(w);
    w.on('finish', resolve);
    w.on('error', reject);
  });
}
```

Uso:

```js
import { uploadFile, downloadToFile } from './storage-client.js';

const result = await uploadFile({
  filePath: './laudo.pdf',
  folder: 'laudos/2026/06',
});
// Salvar result.path no banco

await downloadToFile(result.path, './recebido.pdf');
```
