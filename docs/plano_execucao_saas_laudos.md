# Plano de Execução — SaaS de Laudos Laboratoriais (MVP ~8 semanas)

## 🎯 Objetivo
Entregar um MVP multi-tenant para emissão de laudos laboratoriais com PDF assinado digitalmente (ICP-Brasil) e portal do cliente com login por código. Inclui cadastros básicos (empresa, clientes, amostras, ensaios), geração/armazenamento de PDFs e acesso seguro por tenant.

## 📋 Escopo e Assunções

### Entregáveis MVP
- Cadastros: empresa, clientes, amostras, ensaios
- Sistema de laudos com múltiplos ensaios
- PDF assinado digitalmente (ICP-Brasil)
- Portal do cliente com login por código por e-mail
- Multi-tenant completo com isolamento de dados

### Assunções Técnicas
- Banco relacional com isolamento por tenant
- Certificado A1 ICP-Brasil disponível
- Provedor de e-mail transacional configurado
- Armazenamento de PDFs em bucket seguro
- Pipeline CI/CD básico implementado

### Fora de Escopo (MVP)
- Billing/assinaturas
- Relatórios gerenciais avançados
- Branding avançado por empresa

## 📅 Milestones por Semana

### Semana 1 — Fundamentos & Multi-tenant Base
- ✅ Modelagem de dados multi-tenant e isolamento lógico
- ✅ Cadastro de empresa/laboratório + autenticação administrativa
- ✅ Telemetria/logs básicos e CI/CD inicial

### Semana 2 — Clientes & Amostras (CRUD)
- ✅ CRUD de clientes com validações
- ✅ CRUD de amostras vinculadas ao cliente (por tenant)

### Semana 3 — Ensaios & Modelos de Laudo
- ✅ CRUD de ensaios (nome, descrição, unidades)
- ✅ Estrutura de laudo (modelo com múltiplos ensaios)

### Semana 4 — Geração de PDF (sem assinatura)
- ✅ Template base de laudo e renderização PDF
- ✅ Armazenamento seguro do PDF e visualização interna

### Semana 5 — Assinatura Digital (ICP-Brasil)
- ✅ Integração com certificado A1 e carimbo de tempo
- ✅ Metadados de assinatura e validação compatível (ex.: Adobe Reader)

### Semana 6 — Portal do Cliente (Magic Code)
- ✅ Fluxo de login via código por e-mail (sem senha fixa)
- ✅ Listagem e download de laudos do próprio cliente

### Semana 7 — Hardening, Segurança & Testes
- ✅ Enforcement multi-tenant, rate limiting, auditoria básica
- ✅ Testes integrados/E2E e performance inicial

### Semana 8 — Piloto, UAT & Go-live
- ✅ Rodada de UAT com 1–2 laboratórios
- ✅ Correções, documentação e checklist de produção

## 🎯 Backlog Priorizado (MVP)

### P0 (Obrigatório)
- [x] Isolamento multi-tenant em todas as entidades
- [x] Cadastro de empresa/laboratório e autenticação administrativa
- [x] CRUD de clientes, amostras, ensaios
- [x] Criação e armazenamento de laudos em PDF
- [x] Assinatura digital ICP-Brasil (A1) com carimbo de tempo
- [x] Portal do cliente com login por código (e-mail) e acesso restrito aos próprios laudos
- [x] Envio de e-mails transacionais (códigos de acesso) e rate limiting
- [x] Log/auditoria mínima e LGPD (termos/consentimento básico)

### P1 (Importante)
- [ ] Template de laudo configurável por empresa
- [ ] Reemissão/versão de laudo e histórico
- [ ] Reenvio/expiração de códigos e monitoramento de entregabilidade
- [ ] Relatórios operacionais básicos (volumetria de laudos)

### P2 (Desejável)
- [ ] Branding por empresa (logo/cores no PDF/portal)
- [ ] Exportações CSV (clientes, laudos)
- [ ] Dashboard simples
- [ ] Preparação para automação de cobrança

## ⏱️ Estimativas

### Cronograma
- **Por milestone**: ~1 semana cada (buffer de 15%)
- **Total**: ~8–9 semanas
- **Buffer adicional**: 1 semana para contingências

### Pré-requisitos Críticos (não-contabilizados)
- Obtenção/configuração de certificado A1 ICP-Brasil
- Setup de DNS e domínio de e-mail (DKIM/SPF/DMARC)
- Configuração de ambiente de produção

## ✅ Critérios de Aceite (amostrais)

### Multi-tenant
- Dados de um laboratório não são visíveis a outro em todas as rotas/consultas
- Isolamento completo por tenant em todas as operações

### PDF de Laudo
- Laudo renderiza com dados do laboratório, cliente, amostra e ensaios
- Formatação profissional e legível

### Assinatura Digital
- PDF validado com assinatura ICP-Brasil e carimbo de tempo
- Compatibilidade com leitores padrão (Adobe Reader, etc.)

### Portal do Cliente
- Login via código enviado por e-mail (sem senha fixa)
- Cliente vê e baixa apenas seus próprios laudos
- Interface intuitiva e responsiva

## ⚠️ Riscos & Mitigações

### ICP-Brasil/Assinatura Digital
- **Risco**: Variância de bibliotecas e compatibilidade
- **Mitigação**: Validar em sandbox e com amostras reais logo na Semana 5

### Entregabilidade de E-mail
- **Risco**: Códigos de acesso não entregues
- **Mitigação**: Configurar domínio/remetente adequado, monitorar bounces e aplicar rate limit

### Segurança Multi-tenant
- **Risco**: Vazamento de dados entre tenants
- **Mitigação**: Testes automatizados para injeção de tenant e revisão de queries

### LGPD
- **Risco**: Não conformidade com proteção de dados
- **Mitigação**: Retenção mínima de dados pessoais e controles de acesso/logs

## 📦 Entregáveis

### Código e Infraestrutura
- Repositório com código fonte completo
- Pipelines de CI/CD configurados
- Scripts de deploy e rollback

### Documentação
- `docs/` com arquitetura do sistema
- Instruções de operação e manutenção
- Guia de uso para administradores e clientes
- Documentação de API

### Produção
- Ambiente de produção configurado
- Checklist de go-live
- Monitoramento e alertas básicos

## 🚀 Próximos Passos

1. **Validação com Clientes**: Entrevistas com 3-5 laboratórios pequenos
2. **Refinamento do MVP**: Ajustes baseados no feedback
3. **Desenvolvimento Iterativo**: Implementação seguindo os milestones
4. **Testes e Validação**: UAT com laboratórios piloto
5. **Go-live**: Lançamento controlado com suporte

## 📊 Métricas de Sucesso

### Técnicas
- Tempo de resposta < 2s para operações críticas
- Disponibilidade > 99.5%
- Zero vazamentos de dados entre tenants

### Negócio
- 3+ laboratórios ativos no piloto
- 100+ laudos emitidos com sucesso
- Feedback positivo dos usuários (NPS > 7)

---

**Criado em**: $(date)  
**Versão**: 1.0  
**Status**: Em desenvolvimento
