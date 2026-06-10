const axios = require('axios');
const FormData = require('form-data');
const config = require('../config');

function buildBadGateway(message, cause) {
  const err = new Error(message);
  err.status = 502;
  if (cause) err.cause = cause;
  return err;
}

function client() {
  if (!config.storage.apiKey) {
    throw buildBadGateway('STORAGE_API_KEY não configurada');
  }
  return axios.create({
    baseURL: config.storage.baseUrl,
    headers: { 'X-API-Key': config.storage.apiKey },
    timeout: config.storage.timeoutMs,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
}

async function uploadFile({ buffer, filename, folder }) {
  if (buffer.length > config.storage.maxBytes) {
    throw buildBadGateway(
      `Arquivo excede limite (${buffer.length} > ${config.storage.maxBytes} bytes)`
    );
  }

  const form = new FormData();
  form.append('file', buffer, { filename, contentType: 'application/pdf' });
  if (folder) form.append('folder', folder);

  try {
    const { data } = await client().post('/upload.php', form, {
      headers: form.getHeaders(),
    });
    if (!data || !data.ok || !data.path) {
      throw buildBadGateway('Resposta inválida da Storage API no upload');
    }
    return { path: data.path, filename: data.filename, size: data.size };
  } catch (err) {
    if (err.status === 502) throw err;
    const detail = err.response?.data?.error || err.message;
    throw buildBadGateway(`Falha no upload para Storage: ${detail}`, err);
  }
}

async function downloadFile(path) {
  try {
    const { data } = await client().get('/download.php', {
      params: { path },
      responseType: 'arraybuffer',
    });
    return Buffer.from(data);
  } catch (err) {
    const detail = err.response?.data
      ? Buffer.from(err.response.data).toString('utf8').slice(0, 200)
      : err.message;
    throw buildBadGateway(`Falha no download da Storage: ${detail}`, err);
  }
}

module.exports = { uploadFile, downloadFile };
