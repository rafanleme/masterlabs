// Especificação OpenAPI estática servida em /swagger e /swagger.json.
// Mantenha em sincronia ao adicionar/alterar rotas.

const problem = { $ref: '#/components/schemas/Problem' };

const idParam = {
  name: 'id', in: 'path', required: true, schema: { type: 'string' },
};
const pageParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
  { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
];

function crudPaths(tag, { searchable = true, extraListParams = [], hasStatusRoute = false } = {}) {
  const base = {
    post: {
      tags: [tag],
      summary: `Cria ${tag.toLowerCase()}`,
      security: [{ bearerAuth: [] }],
      requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
      responses: {
        201: { description: 'Criado' },
        400: { description: 'Validação', content: { 'application/json': { schema: problem } } },
        409: { description: 'Conflito', content: { 'application/json': { schema: problem } } },
      },
    },
    get: {
      tags: [tag],
      summary: `Lista ${tag.toLowerCase()} (paginado, escopo do tenant)`,
      security: [{ bearerAuth: [] }],
      parameters: [...pageParams, ...(searchable ? [{ name: 'search', in: 'query', schema: { type: 'string' } }] : []), ...extraListParams],
      responses: { 200: { description: 'OK' } },
    },
  };

  const byId = {
    get: {
      tags: [tag], summary: 'Busca por ID', security: [{ bearerAuth: [] }],
      parameters: [idParam],
      responses: { 200: { description: 'OK' }, 404: { description: 'Não encontrado' } },
    },
    patch: {
      tags: [tag], summary: 'Atualiza parcialmente', security: [{ bearerAuth: [] }],
      parameters: [idParam],
      requestBody: { content: { 'application/json': { schema: { type: 'object' } } } },
      responses: { 200: { description: 'OK' }, 404: { description: 'Não encontrado' } },
    },
    delete: {
      tags: [tag], summary: 'Desativa (soft delete) — apenas ADMIN', security: [{ bearerAuth: [] }],
      parameters: [idParam],
      responses: { 204: { description: 'Removido' }, 403: { description: 'Sem permissão' }, 404: { description: 'Não encontrado' } },
    },
  };

  const statusRoute = hasStatusRoute
    ? {
        patch: {
          tags: [tag], summary: 'Altera status', security: [{ bearerAuth: [] }],
          parameters: [idParam],
          requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } } },
          responses: { 200: { description: 'OK' }, 422: { description: 'Transição inválida' } },
        },
      }
    : null;

  return { base, byId, statusRoute };
}

const clients      = crudPaths('Clients', { extraListParams: [{ name: 'tipoPessoa', in: 'query', schema: { type: 'string', enum: ['PF', 'PJ'] } }] });
const attendances  = crudPaths('Attendances', { hasStatusRoute: true });
const samples      = crudPaths('Samples', { hasStatusRoute: true });
const assays       = crudPaths('Assays');
const templates    = crudPaths('ReportTemplates');
const reports      = crudPaths('Reports', { hasStatusRoute: true });
const users        = crudPaths('Users');

module.exports = {
  openapi: '3.0.0',
  info: {
    title: 'MasterLabs API',
    version: '1.0.0',
    description: 'SaaS multi-tenant de emissão de laudos laboratoriais: cadastros, laudos, PDFs versionados, portal do cliente e auditoria.',
  },
  tags: [
    { name: 'Health' }, { name: 'Tenants' }, { name: 'Auth' }, { name: 'Users' },
    { name: 'Clients' }, { name: 'Attendances' }, { name: 'Samples' }, { name: 'Assays' },
    { name: 'ReportTemplates' }, { name: 'Reports' }, { name: 'Reports PDF' },
    { name: 'Portal' }, { name: 'Stats' }, { name: 'Audit' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      portalAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Token do portal do cliente (scope "portal")' },
    },
    schemas: {
      Problem: {
        type: 'object',
        properties: {
          type: { type: 'string' }, title: { type: 'string' }, status: { type: 'integer' },
          detail: { type: 'string' }, instance: { type: 'string' }, correlationId: { type: 'string' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          total: { type: 'integer' }, page: { type: 'integer' },
          pageSize: { type: 'integer' }, totalPages: { type: 'integer' },
        },
      },
    },
  },
  paths: {
    '/healthz':    { get: { tags: ['Health'], summary: 'Healthcheck geral (inclui MySQL)', responses: { 200: { description: 'Healthy' }, 503: { description: 'Unhealthy' } } } },
    '/healthz/db': { get: { tags: ['Health'], summary: 'Healthcheck exclusivo do MySQL', responses: { 200: { description: 'Healthy' }, 503: { description: 'Unhealthy' } } } },

    '/api/v1/tenants/register': {
      post: {
        tags: ['Tenants'],
        summary: 'Registra laboratório (tenant) + usuário ADMIN inicial',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: {
            type: 'object',
            required: ['razaoSocial', 'nomeFantasia', 'cnpj', 'email', 'adminName', 'adminEmail', 'adminPassword'],
            properties: {
              razaoSocial: { type: 'string' }, nomeFantasia: { type: 'string' },
              cnpj: { type: 'string' }, email: { type: 'string' }, telefone: { type: 'string' },
              endereco: { type: 'string' }, adminName: { type: 'string' },
              adminEmail: { type: 'string' }, adminPassword: { type: 'string' },
            },
          } } },
        },
        responses: { 201: { description: 'Tenant criado (retorna token JWT)' }, 409: { description: 'CNPJ/e-mail já cadastrado' } },
      },
    },

    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login de usuário interno',
        description: 'Se o e-mail existir em mais de um laboratório, a resposta é 409 com a lista de labs — repita o login enviando também o campo cnpj.',
        requestBody: { required: true, content: { 'application/json': { schema: {
          type: 'object', required: ['email', 'password'],
          properties: { email: { type: 'string' }, password: { type: 'string' }, cnpj: { type: 'string', description: 'Desambiguação quando o e-mail existe em vários tenants' } },
        } } } },
        responses: {
          200: { description: 'Token + usuário' },
          401: { description: 'Credenciais inválidas' },
          409: { description: 'E-mail em múltiplos laboratórios (payload.labs)' },
        },
      },
    },
    '/api/v1/auth/me': {
      get: { tags: ['Auth'], summary: 'Dados do usuário autenticado', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' }, 401: { description: 'Não autenticado/inativo' } } },
    },

    '/api/v1/users':      { post: { ...users.base.post, summary: 'Cria usuário (ADMIN)' }, get: { ...users.base.get, summary: 'Lista usuários do tenant (ADMIN)', parameters: [...users.base.get.parameters, { name: 'role', in: 'query', schema: { type: 'string', enum: ['ADMIN', 'ANALYST', 'VIEWER'] } }, { name: 'active', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } }] } },
    '/api/v1/users/{id}': { ...users.byId, delete: { ...users.byId.delete, summary: 'Desativa usuário (ADMIN, não permite a si mesmo)' } },

    '/api/v1/clients':            { post: clients.base.post, get: clients.base.get },
    '/api/v1/clients/export.csv': { get: { tags: ['Clients'], summary: 'Exporta clientes em CSV', security: [{ bearerAuth: [] }], responses: { 200: { description: 'CSV', content: { 'text/csv': {} } } } } },
    '/api/v1/clients/{id}':       clients.byId,

    '/api/v1/attendances':             { post: attendances.base.post, get: attendances.base.get },
    '/api/v1/attendances/{id}':        attendances.byId,
    '/api/v1/attendances/{id}/status': attendances.statusRoute,

    '/api/v1/samples':             { post: samples.base.post, get: samples.base.get },
    '/api/v1/samples/{id}':        samples.byId,
    '/api/v1/samples/{id}/status': samples.statusRoute,

    '/api/v1/assays':      { post: assays.base.post, get: assays.base.get },
    '/api/v1/assays/{id}': assays.byId,

    '/api/v1/report-templates':      { post: templates.base.post, get: templates.base.get },
    '/api/v1/report-templates/{id}': templates.byId,

    '/api/v1/reports':            { post: reports.base.post, get: reports.base.get },
    '/api/v1/reports/export.csv': { get: { tags: ['Reports'], summary: 'Exporta laudos em CSV', security: [{ bearerAuth: [] }], responses: { 200: { description: 'CSV', content: { 'text/csv': {} } } } } },
    '/api/v1/reports/{id}':       reports.byId,
    '/api/v1/reports/{id}/status': reports.statusRoute,
    '/api/v1/reports/{id}/items/{assayId}': {
      patch: {
        tags: ['Reports'], summary: 'Atualiza resultado de um ensaio do laudo', security: [{ bearerAuth: [] }],
        parameters: [idParam, { name: 'assayId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { valor: { type: 'string' }, valorNumerico: { type: 'number' }, observacoes: { type: 'string' } } } } } },
        responses: { 200: { description: 'OK (conformidade recalculada)' } },
      },
    },

    '/api/v1/reports/{id}/pdf': {
      post: {
        tags: ['Reports PDF'], summary: 'Gera nova versão do PDF (laudo EMITIDO)', security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: { 201: { description: 'Artifact criado' }, 409: { description: 'Laudo não emitido' }, 502: { description: 'Falha na Storage' } },
      },
      get: {
        tags: ['Reports PDF'], summary: 'Baixa o PDF (última versão ou ?version=N)', security: [{ bearerAuth: [] }],
        parameters: [idParam, { name: 'version', in: 'query', schema: { type: 'integer' } }],
        responses: { 200: { description: 'PDF', content: { 'application/pdf': {} } }, 404: { description: 'PDF não encontrado' } },
      },
    },
    '/api/v1/reports/{id}/pdf-artifacts': {
      get: { tags: ['Reports PDF'], summary: 'Lista versões de PDF do laudo', security: [{ bearerAuth: [] }], parameters: [idParam], responses: { 200: { description: 'OK' } } },
    },

    '/api/v1/portal/auth/request-code': {
      post: {
        tags: ['Portal'], summary: 'Solicita código de acesso por e-mail (magic code)',
        description: 'Resposta é sempre genérica — não revela se o e-mail está cadastrado. Código de 6 dígitos, single-use, expira em 15 min (configurável).',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string' } } } } } },
        responses: { 200: { description: 'Genérico' }, 429: { description: 'Muitas solicitações' } },
      },
    },
    '/api/v1/portal/auth/verify': {
      post: {
        tags: ['Portal'], summary: 'Troca e-mail + código por token do portal',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'code'], properties: { email: { type: 'string' }, code: { type: 'string' }, tenantId: { type: 'string', description: 'Desambiguação quando o e-mail é cliente de vários laboratórios' } } } } } },
        responses: { 200: { description: 'Token do portal + dados do cliente' }, 401: { description: 'Código inválido/expirado' }, 409: { description: 'Múltiplos laboratórios (payload.labs)' } },
      },
    },
    '/api/v1/portal/me': {
      get: { tags: ['Portal'], summary: 'Dados do cliente autenticado no portal', security: [{ portalAuth: [] }], responses: { 200: { description: 'OK' } } },
    },
    '/api/v1/portal/reports': {
      get: { tags: ['Portal'], summary: 'Lista laudos EMITIDOS do próprio cliente', security: [{ portalAuth: [] }], parameters: pageParams, responses: { 200: { description: 'OK' } } },
    },
    '/api/v1/portal/reports/{id}/pdf': {
      get: { tags: ['Portal'], summary: 'Baixa a última versão do PDF do próprio laudo', security: [{ portalAuth: [] }], parameters: [idParam], responses: { 200: { description: 'PDF', content: { 'application/pdf': {} } }, 404: { description: 'Não encontrado / sem PDF' } } },
    },

    '/api/v1/stats/overview': {
      get: { tags: ['Stats'], summary: 'Volumetria do tenant (clientes, atendimentos, amostras, laudos por status e emissões/mês)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'OK' } } },
    },

    '/api/v1/audit-logs': {
      get: {
        tags: ['Audit'], summary: 'Lista trilha de auditoria do tenant (ADMIN)', security: [{ bearerAuth: [] }],
        parameters: [
          ...pageParams,
          { name: 'actorType', in: 'query', schema: { type: 'string', enum: ['USER', 'PORTAL_CLIENT', 'ANONYMOUS'] } },
          { name: 'actorId', in: 'query', schema: { type: 'string' } },
          { name: 'method', in: 'query', schema: { type: 'string' } },
          { name: 'path', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { 200: { description: 'OK' }, 403: { description: 'Apenas ADMIN' } },
      },
    },
  },
};
